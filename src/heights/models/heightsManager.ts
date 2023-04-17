/* eslint-disable @typescript-eslint/ban-ts-comment */
/* eslint-disable @typescript-eslint/no-unsafe-call */
/* eslint-disable @typescript-eslint/no-unsafe-assignment */
/* eslint-disable @typescript-eslint/no-unsafe-argument */
/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/strict-boolean-expressions */
/* eslint-disable @typescript-eslint/no-magic-numbers */
import {
  Cartographic,
  CesiumTerrainProvider,
  sampleTerrain,
  sampleTerrainMostDetailed
} from 'cesium';
import config from 'config';
import { Feature, GeoJSON, Point } from 'geojson';
import traverse from 'traverse';
import { inject, injectable } from 'tsyringe';
import { Logger } from '@map-colonies/js-logger';
import { SERVICES } from '../../common/constants';

export interface ICoordinates {
  longitude: string;
  latitude: string;
}

export interface IHeightModel {
  dem: number;
}

@injectable()
export class HeightsManager {

  public constructor(@inject(SERVICES.LOGGER) private readonly logger: Logger) {}

  public async getHeight(coordinates: ICoordinates): Promise<IHeightModel> {
    this.logger.info({ msg: 'Getting height' });
    const point: GeoJSON = {
      "type": "Feature",
      "properties": {},
      "geometry": {
        "type": "Point",
        "coordinates": [
          ...Object.values(coordinates).map(value => +value)
        ]
      }
    };
    const start = new Date();
    const result = await this.sample(point, { level: 11 });
    const end = new Date();
    console.log(result);
    console.log(`${end.getTime() - start.getTime()} ms`);
    return { dem: ((result as Feature).geometry as Point).coordinates[2] };
  }

  public async getPolygon(polygon: GeoJSON): Promise<GeoJSON> {
    this.logger.info({ msg: 'Getting polygon heights' });

    const bbox = turf.bbox(polygon);
    const cellSide = 1.0; // distance between points (in units)
    const options = {
      units: 'meters', // used in calculating cellSide, can be: degrees, radians, miles, or kilometers (default)
      mask: polygon // if passed a Polygon or MultiPolygon, the grid Points will be created only inside it
    };

    // Creates a Point grid from a bounding box, FeatureCollection or Feature.
    const pointGrid = turf.pointGrid(bbox, cellSide, options); // grid of points
    const pointGridCoordinates = pointGrid.features.map(f => f.geometry.coordinates);

    console.log(pointGridCoordinates); // 2,359 points inside the polygon

    pointGridCoordinates.forEach(p => {
      viewer.entities.add({
        position: Cesium.Cartesian3.fromDegrees(p[0], p[1]),
        point: {
          color: Cesium.Color.fromRandom(),
          pixelSize: 5,
          heightReference: Cesium.HeightReference.RELATIVE_TO_GROUND
        }
      });
    });
    const positions = pointGridCoordinates.map(p => Cesium.Cartographic.fromDegrees(p[0], p[1]));

    let bbox = turf.bbox(coords);
//      let bboxLayer = L.geoJSON(turf.bboxPolygon(bbox)).addTo(map);
//      map.fitBounds(bboxLayer.getBounds());

      let cellWidth = 0.05;
      let cellHeight = 0.05;

      let bufferedBbox = turf.bbox(turf.buffer(coords, cellWidth, {units: 'kilometers'}));
      let options = { units: "kilometers", mask: coords};
      let squareGrid = turf.squareGrid(
        bufferedBbox,
//        bbox,
        cellWidth,
        options
      );

//      L.geoJSON(squareGrid).addTo(map);      
      
      let clippedGridLayer = L.geoJSON().addTo(map);

      turf.featureEach(squareGrid, function (currentFeature, featureIndex) {
        let intersected = turf.intersect(coords.features[0], currentFeature);
        clippedGridLayer.addData(intersected);
      });

    const start = new Date();
    const result = await this.sample(positions, { level: 11 });
    const end = new Date();
    console.log(result);
    console.log(`${end.getTime() - start.getTime()} ms`);
    return result;
  }

  public async getHeights(geojson: GeoJSON): Promise<GeoJSON> {
    this.logger.info({ msg: 'Getting heights' });
    const start = new Date();
    const result = await this.sample(geojson, { level: 11 });
    const end = new Date();
    console.log(result);
    console.log(`${end.getTime() - start.getTime()} ms`);
    return result;
  }

  private async sample(data: GeoJSON, options?: { level: number }): Promise<GeoJSON> {
    return new Promise((resolve, reject) => {
      const positions: Cartographic[] = [];
      const dPositions: {longitude: number, latitude: number}[] = [];
      const paths: string[][] = [];

      traverse(data).forEach(function() {
        // @ts-ignore
        if (this.isLeaf && Number.isFinite(this.node) && Array.isArray(this.parent?.node) && this.parent?.node.length > 1 && this.key == '0') {
          positions.push(Cartographic.fromDegrees(this.parent?.node[0], this.parent?.node[1]));
          dPositions.push({ longitude: this.parent?.node[0], latitude: this.parent?.node[1] });
          paths.push(this.parent?.path as string[]);
        }
      });

      if (positions.length && dPositions.length) {
        
        const CesiumProvider = new CesiumTerrainProvider({
          url: config.get<string>('terrainProviderUrl')
        });

        const MIN_ZOOM_LEVEL = 0;
        const MAX_ZOOM_LEVEL = 11;

        let sampleTerrainPromise;
        if (options?.level) {
          if ((options.level < MIN_ZOOM_LEVEL) || (options.level > MAX_ZOOM_LEVEL)) {
            return reject(new Error(`Level must between ${MIN_ZOOM_LEVEL} and ${MAX_ZOOM_LEVEL}`));
          }
          sampleTerrainPromise = sampleTerrain(CesiumProvider, options.level, positions);
        } else {
          sampleTerrainPromise = sampleTerrainMostDetailed(CesiumProvider, positions);
        }
        sampleTerrainPromise.then(() => {
          paths.forEach((path, i) => {
            if (path.length) {
              traverse(data).set(path, [dPositions[i].longitude, dPositions[i].latitude, positions[i].height ? Number(positions[i].height.toFixed(2)) : undefined]);
            } else {
              return reject (new Error('Invalid GeoJSON input file'));
            }
          });
          return resolve(data);
        }).catch(function (e) {
          return reject(e);
        });

      } else {
        return reject(new Error('No coordinates found in input file'));
      }
    });
  }
}
