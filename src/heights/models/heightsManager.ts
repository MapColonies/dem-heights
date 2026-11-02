import { MultiPolygon, Polygon } from 'geojson';
import client from 'prom-client';
import { container, inject, injectable } from 'tsyringe';
import { Logger } from '@map-colonies/js-logger';
import { PycswDemCatalogRecord } from '@map-colonies/mc-model-types';
import PromisePool from '@supercharge/promise-pool';
import booleanPointInPolygon from '@turf/boolean-point-in-polygon';
import { CommonErrors } from '../../common/commonErrors';
import { SERVICES } from '../../common/constants';
import { IConfig } from '../../common/interfaces';
import { CATALOG_RECORDS_MAP, DEM_TERRAIN_CACHE_MANAGER } from '../../containerConfig';
import { CatalogItemSelector, GeoPoint, HeightProviders, PosWithHeight, PosWithProvider, TerrainTypes } from '../interfaces';
import { compareCatalogRecordsByResolutionAndDate, resolveCatalogItem } from '../utilities';
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
    @inject(SERVICES.CONFIG) private readonly config: IConfig,
    @inject(CommonErrors) private readonly commonErrors: CommonErrors,
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

  public async getPoints(
    points: GeoPoint[],
    requestedProductType: TerrainTypes,
    reqCtx?: Record<string, unknown>,
    catalogItem?: CatalogItemSelector
  ): Promise<PosWithHeight[]> {
    this.logger.info({ pointsNumber: points.length, catalogItem, location: '[HeightsManager] [getPoints]', ...reqCtx });

    // eslint-disable-next-line @typescript-eslint/naming-convention
    this.elevationsRequestsCounter?.inc({ points_number: points.length });

    if (points.length === 0) {
      return [];
    }

    this.runningRequests++;
    try {
      const result = await this.samplePositionsHeights(points, requestedProductType, reqCtx, catalogItem);
      this.logger.info({
        totalRequests: result.totalRequests,
        pointsNumber: points.length,
        location: '[HeightsManager] [getPoints]',
        ...reqCtx,
      });
      return result.positions;
    } finally {
      this.runningRequests--;
    }
  }

  private async samplePositionsHeights(
    positionsArr: GeoPoint[],
    requestedProductType: TerrainTypes,
    reqCtx?: Record<string, unknown>,
    catalogItem?: CatalogItemSelector
  ): Promise<{ positions: PosWithHeight[]; totalRequests: number }> {
    // Snapshot the provider map and catalog once per request. Both are rebuilt wholesale on a
    // background timer; resolving them fresh per access could pair a providerKey chosen against
    // one snapshot with a provider/catalog map from a later rebuild (provider becomes undefined,
    // sample() throws).
    const heightProviders = this.heightProviders;
    const catalogRecordsMap = this.catalogRecordsMap;

    let pinnedProviderKey: string | undefined;
    if (catalogItem !== undefined) {
      const resolution = resolveCatalogItem(catalogItem.productId, catalogItem.productType, heightProviders, catalogRecordsMap);

      if (resolution.status === 'not_in_catalog') {
        this.logger.error({ msg: 'Unknown catalog item', catalogItem, location: '[HeightsManager] [samplePositionsHeights]', ...reqCtx });
        throw this.commonErrors.UNKNOWN_CATALOG_ITEM;
      }
      if (resolution.status === 'not_ready') {
        this.logger.error({
          msg: 'Catalog item has no loaded provider',
          catalogItem,
          location: '[HeightsManager] [samplePositionsHeights]',
          ...reqCtx,
        });
        throw this.commonErrors.CATALOG_ITEM_NOT_READY;
      }
      if (resolution.matchCount > 1) {
        this.logger.warn({
          msg: 'Multiple catalog items matched the given productId+catalogProductType; selected the best by resolution/date',
          matchCount: resolution.matchCount,
          selectedProviderKey: resolution.providerKey,
          catalogItem,
          location: '[HeightsManager] [samplePositionsHeights]',
          ...reqCtx,
        });
      }
      pinnedProviderKey = resolution.providerKey;
    }

    const attachProviderStart = performance.now();
    const positionsWithProviders =
      pinnedProviderKey !== undefined
        ? this.attachPinnedProviderToPositions(positionsArr, pinnedProviderKey, catalogRecordsMap, reqCtx)
        : this.attachProviderToPositions(positionsArr, requestedProductType, heightProviders, catalogRecordsMap);
    this.logger.info({
      attachProviderTime: performance.now() - attachProviderStart,
      pointsNumber: positionsArr.length,
      location: '[HeightsManager] [samplePositionsHeights]',
      ...reqCtx,
    });

    // Group points by the provider chosen for them (null = no provider), keeping each point's
    // original index so results can be scattered back in input order.
    const groups = new Map<string | null, { point: GeoPoint; index: number }[]>();
    positionsWithProviders.forEach((position, index) => {
      const key = position.providerKey ?? null;
      const bucket = groups.get(key) ?? [];
      bucket.push({ point: { longitude: position.longitude, latitude: position.latitude }, index });
      groups.set(key, bucket);
    });

    const groupEntries = [...groups.entries()];
    const finalPositionsWithHeights = new Array<PosWithHeight>(positionsWithProviders.length);

    await PromisePool.for(groupEntries)
      .withConcurrency(Math.max(1, groupEntries.length))
      .handleError((error) => {
        // Without this, promise-pool silently collects sample() failures and resolves normally,
        // leaving height slots undefined. Rethrow so the request fails loudly instead.
        throw error;
      })
      .process(async ([providerKey, entries]) => {
        if (providerKey === null) {
          entries.forEach(({ point, index }) => {
            finalPositionsWithHeights[index] = { ...point, height: null } as PosWithHeight;
          });
          return;
        }

        const samplingStart = performance.now();
        const provider = heightProviders[providerKey];
        const record = catalogRecordsMap[providerKey];
        const heights = await provider.sample(entries.map(({ point }) => point));

        this.logger.info({
          terrainSamplingTime: performance.now() - samplingStart,
          providerId: providerKey,
          pointsNumber: positionsArr.length,
          location: '[HeightsManager] [samplePositionsHeights]',
          ...reqCtx,
        });

        entries.forEach(({ point, index }, i) => {
          const height = heights[i];
          finalPositionsWithHeights[index] = {
            ...point,
            height,
            ...(height !== null && record.productId !== undefined ? { productId: record.productId } : {}),
          } as PosWithHeight;
        });
      });

    return { positions: finalPositionsWithHeights, totalRequests: groupEntries.length };
  }

  private attachProviderToPositions(
    positions: GeoPoint[],
    requestedProductType: TerrainTypes,
    heightProviders: HeightProviders,
    catalogRecordsMap: Record<string, PycswDemCatalogRecord>
  ): PosWithProvider[] {
    /*
     * Filter providers by requested product type (unless MIXED)
     * Filter providers by footprint point intersection
     * Sort by highest resolution (lower resolutionMeter is better), tie-break on newest updateDate
     * Attach the best provider key to the point
     */
    // Provider list and product-type filter are the same for every point — compute once.
    const providerEntries = Object.entries(heightProviders);
    const productTypeFiltered =
      requestedProductType !== TerrainTypes.MIXED
        ? providerEntries.filter(([key]) => catalogRecordsMap[key].productType?.includes(requestedProductType))
        : providerEntries;

    return positions.map((position) => {
      const footprintFiltered = productTypeFiltered.filter(([key]) =>
        booleanPointInPolygon([position.longitude, position.latitude], catalogRecordsMap[key].footprint as Polygon | MultiPolygon)
      );

      const sorted = footprintFiltered.sort(([aKey], [bKey]) =>
        compareCatalogRecordsByResolutionAndDate(catalogRecordsMap[aKey], catalogRecordsMap[bKey])
      );

      if (sorted.length === 0) {
        return { ...position } as PosWithProvider;
      }

      const [providerKey] = sorted[0];
      return { ...position, providerKey } as PosWithProvider;
    });
  }

  // Unlike auto-select, a point outside the pinned footprint fails the whole request instead of getting a null height.
  private attachPinnedProviderToPositions(
    positions: GeoPoint[],
    providerKey: string,
    catalogRecordsMap: Record<string, PycswDemCatalogRecord>,
    reqCtx?: Record<string, unknown>
  ): PosWithProvider[] {
    const footprint = catalogRecordsMap[providerKey].footprint as Polygon | MultiPolygon;

    return positions.map((position) => {
      if (!booleanPointInPolygon([position.longitude, position.latitude], footprint)) {
        this.logger.error({
          msg: 'Point is outside the catalog item coverage',
          position,
          providerKey,
          location: '[HeightsManager] [attachPinnedProviderToPositions]',
          ...reqCtx,
        });
        throw this.commonErrors.POINT_OUTSIDE_CATALOG_ITEM_COVERAGE;
      }
      return { ...position, providerKey } as PosWithProvider;
    });
  }
}
