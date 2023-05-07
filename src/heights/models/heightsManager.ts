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
import fetch from 'cross-fetch';
import { Feature, FeatureCollection, GeoJSON, MultiPolygon, Point, Polygon } from 'geojson';
import traverse from 'traverse';
import { inject, injectable } from 'tsyringe';
import bbox from '@turf/bbox';
import pointGrid from '@turf/point-grid';
import { Properties, Units } from '@turf/turf';
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

  public async getPoints(points: GeoJSON): Promise<GeoJSON> {
    this.logger.info({ msg: 'Getting points heights' });
    const start = new Date();
    const result = await this.sample(points, { level: 11 });
    const end = new Date();
    console.log(result);
    console.log(`${end.getTime() - start.getTime()} ms`);
    return result;
  }

  public async getPath(path: GeoJSON): Promise<GeoJSON> {
    this.logger.info({ msg: 'Getting path heights' });
    const start = new Date();
    const result = await this.sample(path, { level: 11 });
    const end = new Date();
    console.log(result);
    console.log(`${end.getTime() - start.getTime()} ms`);
    return result;
  }

  public async getPolygon(polygon: GeoJSON): Promise<GeoJSON> {
    this.logger.info({ msg: 'Getting polygon heights' });

    const polygonBbox = bbox(polygon);
    const cellSide = 600.0; // distance between points (in units)
    const options = {
      units: 'meters' as Units, // used in calculating cellSide, can be: degrees, radians, miles, or kilometers (default)
      mask: (polygon as FeatureCollection).features[0] as Feature<Polygon | MultiPolygon, Properties> // if passed a Polygon or MultiPolygon, the grid Points will be created only inside it
    };

    // Creates a Point grid from a bounding box, FeatureCollection or Feature.
    const polygonPointGrid = pointGrid(polygonBbox, cellSide, options); // grid of points inside the given polygon
    // turf.squareGrid(...);
    // turf.triangleGrid(...);

    const start = new Date();
    const result = await this.sample(polygonPointGrid, { level: 11 });
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
            return reject(new Error(`Level must be between ${MIN_ZOOM_LEVEL} and ${MAX_ZOOM_LEVEL}`));
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
