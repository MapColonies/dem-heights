import { Polygon } from 'geojson';
import client from 'prom-client';
import { container, inject, injectable } from 'tsyringe';
import { Logger } from '@map-colonies/js-logger';
import PromisePool from '@supercharge/promise-pool/dist';
import booleanPointInPolygon from '@turf/boolean-point-in-polygon';
import { Feature } from '@turf/turf';
import { CommonErrors } from '../../common/commonErrors';
import { SERVICES } from '../../common/constants';
import { IConfig } from '../../common/interfaces';
import { CATALOG_RECORDS_MAP, DEM_TERRAIN_CACHE_MANAGER } from '../../containerConfig';
import { GeoPoint, PosWithHeight, PosWithProvider, TerrainTypes } from '../interfaces';
import DEMTerrainCacheManager from './DEMTerrainCacheManager';
import { CatalogRecords } from './catalogRecords';

export interface ICoordinates {
  longitude: string;
  latitude: string;
}

export interface IHeightModel {
  dem: number;
}

@injectable()
export class HeightsManager {
  private runningRequests = 0;

  private get catalogRecordsMap() {
    return container.resolve<CatalogRecords>(CATALOG_RECORDS_MAP).getValue();
  }

  private get heightProviders() {
    return container.resolve<DEMTerrainCacheManager>(DEM_TERRAIN_CACHE_MANAGER).heightProviders;
  }

  private readonly elevationsRequestsCounter?: client.Counter<'points_number'>;

  public constructor(
    @inject(SERVICES.LOGGER) private readonly logger: Logger,
    @inject(CommonErrors) private readonly commonErrors: CommonErrors,
    @inject(SERVICES.CONFIG) private readonly config: IConfig,
    @inject(SERVICES.METRICS_REGISTRY) registry?: client.Registry
  ) {
    if (registry !== undefined) {
      // eslint-disable-next-line @typescript-eslint/no-this-alias
      const self = this;
      new client.Gauge({
        name: 'elevations_current_requests_count',
        help: 'Currently running elevations requests',
        collect(): void {
          this.set(self.runningRequests);
        },
        registers: [registry],
      });

      this.elevationsRequestsCounter = new client.Counter({
        name: 'elevations_requests_total',
        help: 'Total elevations requests',
        labelNames: ['points_number'] as const,
        registers: [registry],
      });
    }
  }

  public async getPoints(points: GeoPoint[], requestedProductType: TerrainTypes, reqCtx?: Record<string, unknown>): Promise<PosWithHeight[]> {
    this.logger.info({ pointsNumber: points.length, location: '[HeightsManager] [getPoints]', ...reqCtx });

    this.runningRequests++;
    // eslint-disable-next-line @typescript-eslint/naming-convention
    this.elevationsRequestsCounter?.inc({ points_number: points.length });

    if (points.length === 0) {
      this.runningRequests--;
      return [];
    }

    const result = await this.samplePositionsHeights(points, requestedProductType, reqCtx);

    this.logger.info({
      totalRequests: result.totalRequests,
      pointsNumber: points.length,
      location: '[HeightsManager] [getPoints]',
      ...reqCtx,
    });

    this.runningRequests--;
    return result.positions;
  }

  private async samplePositionsHeights(
    positionsArr: GeoPoint[],
    requestedProductType: TerrainTypes,
    reqCtx?: Record<string, unknown>
  ): Promise<{ positions: PosWithHeight[]; totalRequests: number }> {
    const attachProviderStart = performance.now();
    const positionsWithProviders = this.attachProviderToPositions(positionsArr, requestedProductType);
    this.logger.info({
      attachProviderTime: performance.now() - attachProviderStart,
      pointsNumber: positionsArr.length,
      location: '[HeightsManager] [samplePositionsHeights]',
      ...reqCtx,
    });

    // Group points by the provider chosen for them (null = no provider).
    const groups = new Map<string | null, GeoPoint[]>();
    for (const position of positionsWithProviders) {
      const key = position.providerKey ?? null;
      const bucket = groups.get(key) ?? [];
      bucket.push({ longitude: position.longitude, latitude: position.latitude });
      groups.set(key, bucket);
    }

    const groupEntries = [...groups.entries()];
    const finalPositionsWithHeights: PosWithHeight[] = [];

    const { results } = await PromisePool.for(groupEntries)
      .withConcurrency(Math.max(1, groupEntries.length))
      .process(async ([providerKey, points]) => {
        if (providerKey === null) {
          return points.map((point) => ({ ...point, height: null } as PosWithHeight));
        }

        const samplingStart = performance.now();
        const provider = this.heightProviders[providerKey];
        const record = this.catalogRecordsMap[providerKey];
        const heights = await provider.sample(points);

        this.logger.info({
          terrainSamplingTime: performance.now() - samplingStart,
          providerId: providerKey,
          pointsNumber: positionsArr.length,
          location: '[HeightsManager] [samplePositionsHeights]',
          ...reqCtx,
        });

        return points.map((point, index) => {
          const height = heights[index];
          return {
            ...point,
            height,
            ...(height !== null ? { productId: record.productId as string } : {}),
          } as PosWithHeight;
        });
      });

    finalPositionsWithHeights.push(...(results as PosWithHeight[][]).flat());

    return { positions: finalPositionsWithHeights, totalRequests: groupEntries.length };
  }

  private attachProviderToPositions(positions: GeoPoint[], requestedProductType: TerrainTypes): PosWithProvider[] {
    /*
     * Filter providers by requested product type (unless MIXED)
     * Filter providers by footprint point intersection
     * Sort by highest resolution (lower resolutionMeter is better), tie-break on newest updateDate
     * Attach the best provider key to the point
     */
    return positions.map((position) => {
      const providerEntries = Object.entries(this.heightProviders);

      const productTypeFiltered =
        requestedProductType !== TerrainTypes.MIXED
          ? providerEntries.filter(([key]) => this.catalogRecordsMap[key].productType?.includes(requestedProductType))
          : providerEntries;

      const footprintFiltered = productTypeFiltered.filter(([key]) =>
        booleanPointInPolygon([position.longitude, position.latitude], this.catalogRecordsMap[key].footprint as Feature<Polygon>)
      );

      const sorted = footprintFiltered.sort(([aKey], [bKey]) => {
        const A_BEFORE_B = -1;
        const B_BEFORE_A = 1;
        const recordA = this.catalogRecordsMap[aKey];
        const recordB = this.catalogRecordsMap[bKey];

        switch (true) {
          case (recordA.resolutionMeter as number) < (recordB.resolutionMeter as number):
            return A_BEFORE_B;
          case (recordA.resolutionMeter as number) > (recordB.resolutionMeter as number):
            return B_BEFORE_A;
          default: {
            const dateB = new Date(recordB.updateDate as string | number | Date);
            const dateA = new Date(recordA.updateDate as string | number | Date);
            return dateB.getTime() - dateA.getTime();
          }
        }
      });

      if (sorted.length === 0) {
        return { ...position } as PosWithProvider;
      }

      const [providerKey] = sorted[0];
      return { ...position, providerKey } as PosWithProvider;
    });
  }
}
