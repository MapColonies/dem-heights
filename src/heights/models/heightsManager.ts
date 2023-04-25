import {
    Cartographic,
    sampleTerrainMostDetailed
} from "cesium";
import PromisePool from "@supercharge/promise-pool/dist";
import { container, inject, injectable } from "tsyringe";
import { Logger } from "@map-colonies/js-logger";
import { SERVICES } from "../../common/constants";
import { cartographicArrayClusteringForHeightRequests } from "../utilities";
import { PosWithHeight, PosWithTerrainProvider, TerrainProviders } from "../interfaces";
import { TERRAIN_PROVIDERS } from "../../containerConfig";

export interface ICoordinates {
    longitude: string;
    latitude: string;
}

export interface IHeightModel {
    dem: number;
}

@injectable()
export class HeightsManager {
    private readonly terrainProviders: TerrainProviders = container.resolve(TERRAIN_PROVIDERS);

    public constructor(
        @inject(SERVICES.LOGGER) private readonly logger: Logger,
    ) {}

    public async getPoints(points: Cartographic[]): Promise<PosWithHeight[]> {
        console.log(this.terrainProviders);
        this.logger.info({ msg: "Getting points heights" });
        const start = new Date();
        const result = await this.samplePositionsHeights(points);
        const end = new Date();
        console.log(`${end.getTime() - start.getTime()} ms`);
        console.log('TOTAL REQUESTS => ', result.totalRequests);

        return result.positions;
    }

    private async samplePositionsHeights(positionsArr: Cartographic[]): Promise<{positions: PosWithHeight[], totalRequests: number}> {
        const MAX_REQ_PER_BATCH = 50;
        
        const positionsWithProviders = this.attachTerrainProviderToPositions(positionsArr);

        const { optimizedCluster: sampleTerrainClusteredPositions, totalRequests } =
            cartographicArrayClusteringForHeightRequests(
                positionsWithProviders,
                MAX_REQ_PER_BATCH
            );


        const finalPositionsWithHeights: PosWithHeight[] = [];

        for (const provider of sampleTerrainClusteredPositions) {
            const terrainProvider = this.terrainProviders[provider.providerKey];
            console.log('batches => ', provider.positions.length);

            const { results } = await PromisePool
            .for(provider.positions)
            .withConcurrency(provider.positions.length)
            .useCorrespondingResults()
            .process(async (batch) => {
                // Here we should attach additional info on top of each position returned via the catalog record.
                
                const posHeight = await sampleTerrainMostDetailed(terrainProvider, batch);

                return posHeight;
            });

            finalPositionsWithHeights.push(...(results as Cartographic[][]).flat() as PosWithHeight[]);

        }

        return ({ positions: finalPositionsWithHeights, totalRequests });
    }

    private attachTerrainProviderToPositions(positions: Cartographic[]): PosWithTerrainProvider[] {
        // Here comes some logic to detect which terrain provider is appropriate to each position based on business logic.

       const providerPerPos = Object.values(this.terrainProviders)[0];
       const providerKeyPerPos = Object.keys(this.terrainProviders)[0];

       return positions.map(position => ({...position, providerKey: providerKeyPerPos, terrainProvider: providerPerPos } as PosWithTerrainProvider));
    }

    // public async getPath(path: GeoJSON): Promise<GeoJSON> {
    //   this.logger.info({ msg: 'Getting path heights' });
    //   const start = new Date();
    //   const result = await this.sample(path, { level: 11 });
    //   const end = new Date();
    //   console.log(result);
    //   console.log(`${end.getTime() - start.getTime()} ms`);
    //   return result;
    // }

    // public async getPolygon(polygon: GeoJSON): Promise<GeoJSON> {
    //   this.logger.info({ msg: 'Getting polygon heights' });

    //   const polygonBbox = bbox(polygon);
    //   const cellSide = 600.0; // distance between points (in units)
    //   const options = {
    //     units: 'meters' as Units, // used in calculating cellSide, can be: degrees, radians, miles, or kilometers (default)
    //     mask: (polygon as FeatureCollection).features[0] as Feature<Polygon | MultiPolygon, Properties> // if passed a Polygon or MultiPolygon, the grid Points will be created only inside it
    //   };

    //   // Creates a Point grid from a bounding box, FeatureCollection or Feature.
    //   const polygonPointGrid = pointGrid(polygonBbox, cellSide, options); // grid of points inside the given polygon

    //   // let bbox = turf.bbox(polygon);
    //   // let cellWidth = 0.05;
    //   // let cellHeight = 0.05;

    //   // let bufferedBbox = turf.bbox(turf.buffer(polygon, cellWidth, {units: 'kilometers'}));
    //   // let options = { units: "kilometers", mask: polygon};
    //   // let squareGrid = turf.squareGrid(
    //   //   bufferedBbox,
    //   //   // bbox,
    //   //   cellWidth,
    //   //   options
    //   // );

    //   // turf.featureEach(squareGrid, function (currentFeature, featureIndex) {
    //   //   let intersected = turf.intersect(polygon.features[0], currentFeature);
    //   // });

    //   const start = new Date();
    //   const result = await this.sample(polygonPointGrid, { level: 11 });
    //   const end = new Date();
    //   console.log(result);
    //   console.log(`${end.getTime() - start.getTime()} ms`);
    //   return result;
    // }

    // public async getHeights(geojson: GeoJSON): Promise<GeoJSON> {
    //   this.logger.info({ msg: 'Getting heights' });
    //   const start = new Date();
    //   const result = await this.sample(geojson, { level: 11 });
    //   const end = new Date();
    //   console.log(result);
    //   console.log(`${end.getTime() - start.getTime()} ms`);
    //   return result;
    // }

    // public async getHeight(coordinates: ICoordinates): Promise<IHeightModel> {
    //   this.logger.info({ msg: 'Getting height' });
    //   const point: GeoJSON = {
    //     "type": "Feature",
    //     "properties": {},
    //     "geometry": {
    //       "type": "Point",
    //       "coordinates": [
    //         ...Object.values(coordinates).map(value => +value)
    //       ]
    //     }
    //   };
    //   const start = new Date();
    //   const result = await this.sample(point, { level: 11 });
    //   const end = new Date();
    //   console.log(result);
    //   console.log(`${end.getTime() - start.getTime()} ms`);
    //   return { dem: ((result as Feature).geometry as Point).coordinates[2] };
    // }

    // private async sample(data: GeoJSON, options?: { level: number }): Promise<GeoJSON> {
    //   return new Promise((resolve, reject) => {
    //     const positions: Cartographic[] = [];
    //     const dPositions: {longitude: number, latitude: number}[] = [];
    //     const paths: string[][] = [];

    //     traverse(data).forEach(function() {
    //       // @ts-ignore
    //       if (this.isLeaf && Number.isFinite(this.node) && Array.isArray(this.parent?.node) && this.parent?.node.length > 1 && this.key == '0') {
    //         positions.push(Cartographic.fromDegrees(this.parent?.node[0], this.parent?.node[1]));
    //         dPositions.push({ longitude: this.parent?.node[0], latitude: this.parent?.node[1] });
    //         paths.push(this.parent?.path as string[]);
    //       }
    //     });

    //     if (positions.length && dPositions.length) {

    //       const CesiumProvider = new CesiumTerrainProvider({
    //         url: config.get<string>('terrainProviderUrl')
    //       });

    //       const MIN_ZOOM_LEVEL = 0;
    //       const MAX_ZOOM_LEVEL = 11;

    //       let sampleTerrainPromise;
    //       if (options?.level) {
    //         if ((options.level < MIN_ZOOM_LEVEL) || (options.level > MAX_ZOOM_LEVEL)) {
    //           return reject(new Error(`Level must between ${MIN_ZOOM_LEVEL} and ${MAX_ZOOM_LEVEL}`));
    //         }
    //         sampleTerrainPromise = sampleTerrain(CesiumProvider, options.level, positions);
    //       } else {
    //         sampleTerrainPromise = sampleTerrainMostDetailed(CesiumProvider, positions);
    //         // sampleTerrainPromise = fetch('https://dem-int-proxy-production-nginx-s3-gateway-route-integration.apps.j1lk3njp.eastus.aroapp.io/terrains/srtm100/11/2446/1394.terrain?token=eyJhbGciOiJSUzI1NiIsImtpZCI6Im1hcC1jb2xvbmllcy1pbnQifQ.eyJkIjpbInJhc3RlciIsInJhc3RlcldtcyIsInJhc3RlckV4cG9ydCIsImRlbSIsInZlY3RvciIsIjNkIl0sImlhdCI6MTY3NDYzMjM0Niwic3ViIjoibWFwY29sb25pZXMtYXBwIiwiaXNzIjoibWFwY29sb25pZXMtdG9rZW4tY2xpIn0.D1u28gFlxf_Z1bzIiRHZonUgrdWwhZy8DtmQj15cIzaABRUrGV2n_OJlgWTuNfrao0SbUZb_s0_qUUW6Gz_zO3ET2bVx5xQjBu0CaIWdmUPDjEYr6tw-eZx8EjFFIyq3rs-Fo0daVY9cX1B2aGW_GeJir1oMnJUURhABYRoh60azzl_utee9UdhDpnr_QElNtzJZIKogngsxCWp7tI7wkTuNCBaQM7aLEcymk0ktxlWEAt1E0nGt1R-bx-HnPeeQyZlxx4UQ1nuYTijpz7N8poaCCExOFeafj9T7megv2BzTrKWgfM1eai8srSgNa3I5wKuW0EyYnGZxdbJe8aseZg&kuku='+dPositions[i].longitude.toFixed(8));
    //       }
    //       sampleTerrainPromise.then(() => {
    //         paths.forEach((path, i) => {
    //           if (path.length) {
    //             traverse(data).set(path, [dPositions[i].longitude, dPositions[i].latitude, positions[i].height ? Number(positions[i].height.toFixed(2)) : undefined]);
    //           } else {
    //             return reject (new Error('Invalid GeoJSON input file'));
    //           }
    //         });
    //         return resolve(data);
    //       }).catch(function (e) {
    //         return reject(e);
    //       });
    //       // sampleTerrainPromise.then(() => {
    //       //   return resolve({
    //       //     "type": "Feature",
    //       //     "properties": {
    //       //       "al": "kuku"
    //       //     },
    //       //     "geometry": {
    //       //       "coordinates": [

    //       //       ],
    //       //       "type": "Polygon"
    //       //     }})
    //       // });

    //     } else {
    //       return reject(new Error('No coordinates found in input file'));
    //     }
    //   });
    // }
}
