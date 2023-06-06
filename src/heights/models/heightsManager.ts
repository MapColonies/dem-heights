import { Cartographic, Math as CesiumMath, sampleTerrainMostDetailed } from "cesium";
import { Polygon } from "geojson";
import { Feature } from "@turf/turf";
import booleanPointInPolygon from "@turf/boolean-point-in-polygon";
import { PycswDemCatalogRecord } from "@map-colonies/mc-model-types";
import PromisePool from "@supercharge/promise-pool/dist";
import { container, inject, injectable } from "tsyringe";
import { Logger } from "@map-colonies/js-logger";
import { SERVICES } from "../../common/constants";
import { cartographicArrayClusteringForHeightRequests } from "../utilities";
import { AdditionalFieldsEnum, PosWithHeight, PosWithTerrainProvider, TerrainTypes } from "../interfaces";
import { CATALOG_RECORDS_MAP, DEM_TERRAIN_CACHE_MANAGER } from "../../containerConfig";
import { IConfig } from "../../common/interfaces";
import { CommonErrors } from "../../common/commonErrors";
import DEMTerrainCacheManager from "./DEMTerrainCacheManager";

export interface ICoordinates {
    longitude: string;
    latitude: string;
}

export interface IHeightModel {
    dem: number;
}

@injectable()
export class HeightsManager {
    private readonly demTerrainCacheManager = container.resolve<DEMTerrainCacheManager>(DEM_TERRAIN_CACHE_MANAGER);
    private readonly catalogRecordsMap = container.resolve<Record<string, PycswDemCatalogRecord>>(CATALOG_RECORDS_MAP);
    private readonly terrainProviders = this.demTerrainCacheManager.terrainProviders;

    public constructor(
        @inject(SERVICES.LOGGER) private readonly logger: Logger,
        @inject(CommonErrors) private readonly commonErrors: CommonErrors,
        @inject(SERVICES.CONFIG) private readonly config:IConfig
    ) {}

    public async getPoints(
        points: Cartographic[],
        requestedProductType: TerrainTypes,
        excludeFields: AdditionalFieldsEnum[] = []
    ): Promise<PosWithHeight[]> {
        this.logger.info({ msg: `[HeightsManager] [getPoints] Getting points heights for ${points.length} points.` });
        
        const start = new Date();

        const result = await this.samplePositionsHeights(points, requestedProductType, excludeFields);
        const end = new Date();

        this.logger.debug({ msg: `[HeightsManager] [getPoints] Request took ${end.getTime() - start.getTime()} ms` });
        this.logger.debug({ msg: `[HeightsManager] [getPoints] Total Requests ${result.totalRequests}` });


        return result.positions;
    }

    private async samplePositionsHeights(
        positionsArr: Cartographic[],
        requestedProductType: TerrainTypes,
        excludeFields:  AdditionalFieldsEnum[],
    ): Promise<{ positions: PosWithHeight[]; totalRequests: number }> {
        const MAX_REQ_PER_BATCH = 150;
        const MAXIMUM_TILES_PER_REQUEST = this.config.get<number>('maximumTilesPerRequest');

        const positionsWithProviders = this.attachTerrainProviderToPositions(
            positionsArr,
            requestedProductType
        );

        const { optimizedCluster: sampleTerrainClusteredPositions, totalRequests } =
            cartographicArrayClusteringForHeightRequests(positionsWithProviders, MAX_REQ_PER_BATCH);

        if (typeof MAXIMUM_TILES_PER_REQUEST !== 'undefined' && totalRequests > MAXIMUM_TILES_PER_REQUEST) {
            throw this.commonErrors.POINTS_DENSITY_TOO_LOW_ERROR;
        }

        const finalPositionsWithHeights: PosWithHeight[] = [];

        const additionalFields = Object.values(AdditionalFieldsEnum);

        const { results } = await PromisePool.for(sampleTerrainClusteredPositions)
            .withConcurrency(sampleTerrainClusteredPositions.length)
            .useCorrespondingResults()
            .process(async (batch) => {

                if(batch.providerKey === null) {
                    return batch.positions;
                }

                const provider = this.terrainProviders[batch.providerKey];
                const qmeshRecord = this.catalogRecordsMap[batch.providerKey];

                const positionsWithHeights = await sampleTerrainMostDetailed(provider, batch.positions);
                
                // attach additional info on top of each position returned via the catalog record.
                positionsWithHeights.forEach(pos => {
                    for(const field of additionalFields) {
                        if(!excludeFields.includes(field) && typeof qmeshRecord[field] !== 'undefined') {
                            (pos as unknown as Record<string, unknown>)[field] = qmeshRecord[field];
                        }
                    }
                    });
                
               return positionsWithHeights as PosWithHeight[];

        });

        finalPositionsWithHeights.push(
            ...((results as PosWithHeight[][]).flat())
        );

        return { positions: finalPositionsWithHeights, totalRequests };
    }

    private attachTerrainProviderToPositions(
        positions: Cartographic[],
        requestedProductType: TerrainTypes
    ): PosWithTerrainProvider[] {

        /**
         * Filter terrain providers by requested product type.
         * Filter terrain providers by footprint point intersection.
         * Sort by highest resolution (Lower is better).
         * Attach first to the point
         */

        return positions.map((position) => {
            const terrainProvidersEntries = Object.entries(this.terrainProviders);
            
            // Filter terrain providers by requested product type if not MIXED.
            const productTypeFilteredTerrains =
                requestedProductType !== TerrainTypes.MIXED
                    ? terrainProvidersEntries
                          .filter(([terrainKey]) => {
                              const qmeshRecord = this.catalogRecordsMap[terrainKey];

                              return qmeshRecord.productType?.includes(requestedProductType);
                          })
                    : terrainProvidersEntries;

            // Filter terrain providers by footprint point intersection.
            const terrainsFilterByFootprint = productTypeFilteredTerrains.filter(([terrainKey]) => {
                const qmeshRecord = this.catalogRecordsMap[terrainKey];
                const isPointInFootprint = booleanPointInPolygon([CesiumMath.toDegrees(position.longitude), CesiumMath.toDegrees(position.latitude)], qmeshRecord.footprint as Feature<Polygon>);
               
                return isPointInFootprint;
            });
            
            // Sort by highest resolution (Lower is better).
            const sortedTerrainsByResolution = terrainsFilterByFootprint.sort(([terrainAKey], [terrainBKey]) => {
                const A_BEFORE_B = -1;
                const B_BEFORE_A = 1;

                const qmeshRecordA = this.catalogRecordsMap[terrainAKey];
                const qmeshRecordB = this.catalogRecordsMap[terrainBKey];

                switch(true) {
                    case (qmeshRecordA.resolutionMeter as number) < (qmeshRecordB.resolutionMeter as number):
                        return A_BEFORE_B;

                    case (qmeshRecordA.resolutionMeter as number) > (qmeshRecordB.resolutionMeter as number):
                        return B_BEFORE_A;
                    default:
                        // Equal resolutions, compare update date
                        return (qmeshRecordB.updateDate as Date).getTime() - (qmeshRecordA.updateDate as Date).getTime();
                }
            });

            if(sortedTerrainsByResolution.length === 0) {
                return ({
                    ...position
                } as PosWithTerrainProvider);
            }

            // Attach first to the point
            const [terrainKey, provider] = sortedTerrainsByResolution[0];

            return {
                ...position,
                providerKey: terrainKey,
                terrainProvider: provider
            } as PosWithTerrainProvider;
        });
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
    //         dPositions.push({ longitude: th // Here we should attach additional info on top of each position returned via the catalog record.is.parent?.node[0], latitude: this.parent?.node[1] });
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
