import config from 'config';
import { Registry } from 'prom-client';
import { container } from 'tsyringe';
import jsLogger from '@map-colonies/js-logger';
import { PycswDemCatalogRecord } from '@map-colonies/mc-model-types';
import { SERVICES } from '../../src/common/constants';
import { CATALOG_RECORDS_MAP, DEM_TERRAIN_CACHE_MANAGER, PRODUCT_METADATA_FIELDS } from '../../src/containerConfig';
import DEMTerrainCacheManager from '../../src/heights/models/DEMTerrainCacheManager';

async function registerTestValues(shouldInitTerrainProviders = true): Promise<void> {
  const demTerrainCacheManager = new DEMTerrainCacheManager(config);

  if (shouldInitTerrainProviders) {
    await demTerrainCacheManager.initTerrainProviders();
  }

  const catalogRecordsMap = Object.fromEntries(
    (JSON.parse(config.get<string>('demCatalogRecords')) as PycswDemCatalogRecord[]).map((record) => [record.id as string, record])
  );

  const productMetadataFields = config.get<string>('productMetadataFields').split(',');

  container.register(SERVICES.CONFIG, { useValue: config });
  container.register(SERVICES.LOGGER, { useValue: jsLogger({ enabled: false }) });
  container.register(SERVICES.METRICS_REGISTRY, { useValue: new Registry() });
  container.register(CATALOG_RECORDS_MAP, { useValue: catalogRecordsMap });
  container.register(PRODUCT_METADATA_FIELDS, { useValue: productMetadataFields });
  container.register(DEM_TERRAIN_CACHE_MANAGER, { useValue: demTerrainCacheManager });
}

export { registerTestValues };
