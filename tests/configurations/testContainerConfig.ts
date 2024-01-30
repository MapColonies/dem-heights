import config from 'config';
import { Registry } from 'prom-client';
import { container, Lifecycle } from 'tsyringe';
import jsLogger from '@map-colonies/js-logger';
import { PycswDemCatalogRecord } from '@map-colonies/mc-model-types';
import { SERVICES } from '../../src/common/constants';
import { CATALOG_RECORDS_MAP, DEM_TERRAIN_CACHE_MANAGER, PRODUCT_METADATA_FIELDS } from '../../src/containerConfig';
import DEMTerrainCacheManager from '../../src/heights/models/DEMTerrainCacheManager';
import { CatalogRecords } from '../../src/heights/models/catalogRecords';

async function registerTestValues(shouldInitTerrainProviders = true): Promise<void> {
  const demTestCatalogRecords = [
    {
      __typename: 'LayerDemRecord',
      id: '22111111-1111-1111-1111-111111111111',
      type: 'RECORD_DEM',
      classification: '5',
      productName: 'combined_srtm_30_100_il_ever',
      description: null,
      srsId: 'EPSG:4326',
      srsName: 'WGS84GEO',
      producerName: 'IDFMU',
      updateDate: '2023-05-08T17:44:01.000Z',
      sourceDateStart: '2023-04-21T00:00:00.000Z',
      sourceDateEnd: '2023-04-21T00:00:00.000Z',
      sensors: ['UNDEFINED'],
      region: ['Israel'],
      productId: '22111111-1111-1111-1111-111111111111',
      productType: 'QUANTIZED_MESH_DTM_BEST',
      footprint: {
        coordinates: [
          [
            [
              [34.948657607318694, 33.005610036521034],
              [34.948657607318694, 30.99294299883441],
              [35.71215014987706, 30.99294299883441],
              [35.71215014987706, 33.005610036521034],
              [34.948657607318694, 33.005610036521034],
            ],
          ],
          [
            [
              [85.00067953671106, 29.41200402481249],
              [85.00067953671106, 25.577400008336326],
              [89.32770820921479, 25.577400008336326],
              [89.32770820921479, 29.41200402481249],
              [85.00067953671106, 29.41200402481249],
            ],
          ],
        ],
        type: 'MultiPolygon',
      },
      absoluteAccuracyLEP90: 9e-7,
      relativeAccuracyLEP90: 9e-7,
      resolutionDegree: 0.00833,
      resolutionMeter: 30,
      imagingSortieAccuracyCEP90: 30,
      layerPolygonParts: null,
      productBoundingBox: null,
      heightRangeFrom: -500,
      heightRangeTo: 9000,
      geographicArea: 'Israel Nepal',
      undulationModel: 'ILUM',
      dataType: 'INT16',
      noDataValue: 'NO_DATA_999',
      productStatus: 'PUBLISHED',
      hasTerrain: true,
      insertDate: '2023-04-21T00:00:00.000Z',
      wktGeometry: null,
      keywords: 'Israel Nepal, terrain, EPSG:4326',
      links: [
        {
          __typename: 'Link',
          name: '',
          description: '',
          protocol: 'TERRAIN_QMESH',
          url: 'https://dem-int-nginx-s3-gateway-production-route-integration.apps.j1lk3njp.eastus.aroapp.io/api/dem/v1/terrains/combined_srtm_30_100_il_ever',
        },
      ],
    },
    {
      __typename: 'LayerDemRecord',
      id: '11111111-1111-1111-1111-111111111111',
      type: 'RECORD_DEM',
      classification: '5',
      productName: 'srtm100',
      description: null,
      srsId: 'EPSG:4326',
      srsName: 'WGS84GEO',
      producerName: 'IDFMU',
      updateDate: '2023-04-21T23:44:41.000Z',
      sourceDateStart: '2023-04-21T00:00:00.000Z',
      sourceDateEnd: '2023-04-21T00:00:00.000Z',
      sensors: ['UNDEFINED'],
      region: ['Israel'],
      productId: '11111111-1111-1111-1111-111111111111',
      productType: 'QUANTIZED_MESH_DTM_BEST',
      footprint: {
        type: 'Polygon',
        coordinates: [
          [
            [34.999861111, 31.999861111],
            [34.999861111, 33.000138889],
            [36.000138889, 33.000138889],
            [36.000138889, 31.999861111],
            [34.999861111, 31.999861111],
          ],
        ],
      },
      absoluteAccuracyLEP90: 9e-7,
      relativeAccuracyLEP90: 9e-7,
      resolutionDegree: 0.00833,
      resolutionMeter: 100,
      imagingSortieAccuracyCEP90: 30,
      layerPolygonParts: null,
      productBoundingBox: null,
      heightRangeFrom: -500,
      heightRangeTo: 9000,
      geographicArea: 'North',
      undulationModel: 'ILUM',
      dataType: 'INT16',
      noDataValue: 'NO_DATA_999',
      productStatus: 'PUBLISHED',
      hasTerrain: true,
      insertDate: '2023-04-21T00:00:00.000Z',
      wktGeometry: null,
      keywords: 'North, terrain, EPSG:4326',
      links: [
        {
          __typename: 'Link',
          name: '',
          description: '',
          protocol: 'TERRAIN_QMESH',
          url: 'https://dem-int-nginx-s3-gateway-production-route-integration.apps.j1lk3njp.eastus.aroapp.io/api/dem/v1/terrains/srtm100',
        },
      ],
    },
  ];

  const productMetadataFields = config.get<string>('productMetadataFields').split(',');

  container.register(SERVICES.CONFIG, { useValue: config });
  container.register(SERVICES.LOGGER, { useValue: jsLogger({ enabled: false }) });
  container.register(SERVICES.METRICS_REGISTRY, { useValue: new Registry() });
  container.register(CATALOG_RECORDS_MAP, { useClass: CatalogRecords }, { lifecycle: Lifecycle.Singleton });
  container.register(PRODUCT_METADATA_FIELDS, { useValue: productMetadataFields });
  container.register(DEM_TERRAIN_CACHE_MANAGER, { useClass: DEMTerrainCacheManager }, { lifecycle: Lifecycle.Singleton });

  await (async () => {
    const catalogTestRecordsServiceInstance = container.resolve<CatalogRecords>(CATALOG_RECORDS_MAP);
    const demTestTerrainCacheManager = container.resolve<DEMTerrainCacheManager>(DEM_TERRAIN_CACHE_MANAGER);

    catalogTestRecordsServiceInstance.setValue(
      Object.fromEntries((demTestCatalogRecords as unknown as PycswDemCatalogRecord[]).map((record) => [record.id as string, record]))
    );

    const catalogTestRecordsServiceInstance1 = container.resolve<CatalogRecords>(CATALOG_RECORDS_MAP);
    if (shouldInitTerrainProviders) {
      await demTestTerrainCacheManager.initTerrainProviders(demTestCatalogRecords as unknown as PycswDemCatalogRecord[]);
    }
  })();
}

export { registerTestValues };
