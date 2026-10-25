import { container } from 'tsyringe';
import { PycswDemCatalogRecord } from '@map-colonies/mc-model-types';
import { CommonErrorCodes } from '../../../../src/common/commonErrors';
import { HeightsManager, compareCatalogRecordsByResolutionAndDate, resolveCatalogItem } from '../../../../src/heights/models/heightsManager';
import mockJsonPoints, { positionsOutsideOfProviders, emptyPositionsRequest } from '../../../../src/heights/MOCKS/mockData';
import { GetHeightsPointsRequest } from '../../../../src/heights/controllers/heightsController';
import { HeightProviders, TerrainTypes } from '../../../../src/heights/interfaces';
import { CATALOG_RECORDS_MAP, DEM_TERRAIN_CACHE_MANAGER } from '../../../../src/containerConfig';
import DEMTerrainCacheManager from '../../../../src/heights/models/DEMTerrainCacheManager';
import GeotiffHeightProvider from '../../../../src/heights/models/geotiffHeightProvider';
import { CatalogRecords } from '../../../../src/heights/models/catalogRecords';
import { registerTestValues } from '../../../configurations/testContainerConfig';

describe('Get Heights model', function () {
  const mockJsonData = mockJsonPoints as GetHeightsPointsRequest;
  const mockJsonDataOutOfBounds = positionsOutsideOfProviders as GetHeightsPointsRequest;

  let heightsManager: HeightsManager;

  beforeEach(async function () {
    await registerTestValues();
    heightsManager = container.resolve(HeightsManager);
  });

  afterEach(() => {
    container.reset();
    container.clearInstances();
    jest.clearAllMocks();
  });

  describe('Given valid parameters', function () {
    it('Should return positions with height and productId', async function () {
      const result = await heightsManager.getPoints(mockJsonData.positions, TerrainTypes.MIXED);

      expect(result).toHaveLength(mockJsonData.positions.length);
      for (const position of result) {
        expect(position.height).toBe(100);
        expect(position.productId).toBeDefined();
      }
    });

    it('Should return null heights and no productId when no provider matches the product type', async function () {
      const result = await heightsManager.getPoints(mockJsonData.positions, TerrainTypes.DSM);

      expect(result).toHaveLength(mockJsonData.positions.length);
      for (const position of result) {
        expect(position.height).toBeNull();
        expect(position.productId).toBeUndefined();
      }
    });

    it('Should preserve input order when points span providers and out-of-coverage gaps', async function () {
      const positions = [
        { longitude: 35.2, latitude: 32.0 }, // inside footprint
        { longitude: 0, latitude: 0 }, // outside every footprint
        { longitude: 35.5, latitude: 32.5 }, // inside footprint
      ];

      const result = await heightsManager.getPoints(positions, TerrainTypes.MIXED);

      expect(result).toHaveLength(3);
      expect(result[0]).toMatchObject({ longitude: 35.2, latitude: 32.0, height: 100 });
      expect(result[1]).toMatchObject({ longitude: 0, latitude: 0, height: null });
      expect(result[2]).toMatchObject({ longitude: 35.5, latitude: 32.5, height: 100 });
    });

    it('Should return height only for the positions inside a provider footprint', async function () {
      const result = await heightsManager.getPoints(mockJsonDataOutOfBounds.positions, TerrainTypes.MIXED);

      expect(result).toHaveLength(mockJsonDataOutOfBounds.positions.length);
      for (const position of result) {
        expect(position.longitude).toBeDefined();
        expect(position.latitude).toBeDefined();

        const isNullHeight = position.height === null;
        expect(typeof position.productId === 'undefined').toEqual(isNullHeight);
      }
    });
  });

  describe('Given a provider failure', function () {
    it('Should reject instead of silently returning positions with undefined heights when a provider sample fails', async function () {
      const cacheManager = container.resolve<DEMTerrainCacheManager>(DEM_TERRAIN_CACHE_MANAGER);
      for (const provider of Object.values(cacheManager.heightProviders)) {
        jest.spyOn(provider, 'sample').mockRejectedValue(new Error('range read failed'));
      }

      await expect(heightsManager.getPoints(mockJsonData.positions, TerrainTypes.MIXED)).rejects.toThrow('range read failed');
    });
  });

  describe('Given invalid params', function () {
    it('Should return empty array for empty positions', async function () {
      await expect(
        heightsManager.getPoints((emptyPositionsRequest as unknown as GetHeightsPointsRequest).positions, TerrainTypes.MIXED)
      ).resolves.toEqual([]);
    });
  });

  describe('Given a catalogItem selector', function () {
    const pinnedFootprint = {
      type: 'Polygon',
      coordinates: [
        [
          [10, 10],
          [10, 12],
          [12, 12],
          [12, 10],
          [10, 10],
        ],
      ],
    };

    const pinnedRecord = {
      id: 'pinned-dtm',
      productId: 'pinned_prod',
      productType: 'DTM',
      resolutionMeter: 30,
      updateDate: '2023-01-01T00:00:00.000Z',
      footprint: pinnedFootprint,
      links: [{ protocol: 'GEOTIFF', url: 'https://x/cogs/pinned.tif' }],
    };

    it('samples using the resolved pinned record and ignores the requested product type', async function () {
      await container.resolve<DEMTerrainCacheManager>(DEM_TERRAIN_CACHE_MANAGER).initProviders([pinnedRecord] as unknown as PycswDemCatalogRecord[]);
      container.resolve<CatalogRecords>(CATALOG_RECORDS_MAP).setValue({ [pinnedRecord.id]: pinnedRecord as unknown as PycswDemCatalogRecord });

      const result = await heightsManager.getPoints([{ longitude: 11, latitude: 11 }], TerrainTypes.MIXED, undefined, {
        productId: 'pinned_prod',
        productType: TerrainTypes.DTM,
      });

      expect(result).toHaveLength(1);
      expect(result[0].height).toBe(100);
      expect(result[0].productId).toBe('pinned_prod');
    });

    it('rejects with UNKNOWN_CATALOG_ITEM when the selector matches nothing', async function () {
      await expect(
        heightsManager.getPoints([{ longitude: 11, latitude: 11 }], TerrainTypes.MIXED, undefined, {
          productId: 'does_not_exist',
          productType: TerrainTypes.DTM,
        })
      ).rejects.toMatchObject({ errorCode: CommonErrorCodes.UNKNOWN_CATALOG_ITEM });
    });

    it('rejects with CATALOG_ITEM_NOT_READY when the matching record has a GEOTIFF link but no loaded provider', async function () {
      container.resolve<CatalogRecords>(CATALOG_RECORDS_MAP).setValue({ [pinnedRecord.id]: pinnedRecord as unknown as PycswDemCatalogRecord });

      await expect(
        heightsManager.getPoints([{ longitude: 11, latitude: 11 }], TerrainTypes.MIXED, undefined, {
          productId: 'pinned_prod',
          productType: TerrainTypes.DTM,
        })
      ).rejects.toMatchObject({ errorCode: CommonErrorCodes.CATALOG_ITEM_NOT_READY });
    });

    it('rejects with POINT_OUTSIDE_CATALOG_ITEM_COVERAGE and fails the whole request when any point is outside the pinned footprint', async function () {
      await container.resolve<DEMTerrainCacheManager>(DEM_TERRAIN_CACHE_MANAGER).initProviders([pinnedRecord] as unknown as PycswDemCatalogRecord[]);
      container.resolve<CatalogRecords>(CATALOG_RECORDS_MAP).setValue({ [pinnedRecord.id]: pinnedRecord as unknown as PycswDemCatalogRecord });

      await expect(
        heightsManager.getPoints(
          [
            { longitude: 11, latitude: 11 }, // inside
            { longitude: 0, latitude: 0 }, // outside
          ],
          TerrainTypes.MIXED,
          undefined,
          { productId: 'pinned_prod', productType: TerrainTypes.DTM }
        )
      ).rejects.toMatchObject({ errorCode: CommonErrorCodes.POINT_OUTSIDE_CATALOG_ITEM_COVERAGE });
    });
  });
});

describe('resolveCatalogItem', function () {
  const makeRecord = (overrides: Record<string, unknown> = {}): PycswDemCatalogRecord =>
    ({
      productId: 'prod-1',
      productType: 'DTM',
      resolutionMeter: 30,
      updateDate: '2023-01-01T00:00:00.000Z',
      links: [{ protocol: 'GEOTIFF', url: 'https://x/cogs/a.tif' }],
      ...overrides,
    } as unknown as PycswDemCatalogRecord);

  it('returns ready with the provider key for a single exact match', function () {
    const catalogRecordsMap = { rec1: makeRecord() };
    const heightProviders = { rec1: {} as GeotiffHeightProvider } as unknown as HeightProviders;

    expect(resolveCatalogItem('prod-1', TerrainTypes.DTM, heightProviders, catalogRecordsMap)).toEqual({
      status: 'ready',
      providerKey: 'rec1',
      matchCount: 1,
    });
  });

  it('tie-breaks duplicate matches using the shared resolution/date comparator', function () {
    const catalogRecordsMap = {
      worse: makeRecord({ resolutionMeter: 100 }),
      better: makeRecord({ resolutionMeter: 10 }),
    };
    const heightProviders = { worse: {} as GeotiffHeightProvider, better: {} as GeotiffHeightProvider } as unknown as HeightProviders;

    const result = resolveCatalogItem('prod-1', TerrainTypes.DTM, heightProviders, catalogRecordsMap);

    expect(result).toEqual({ status: 'ready', providerKey: 'better', matchCount: 2 });
    expect(compareCatalogRecordsByResolutionAndDate(catalogRecordsMap.better, catalogRecordsMap.worse)).toBeLessThan(0);
  });

  it('returns not_ready when the matching record has a GEOTIFF link but no loaded provider', function () {
    const catalogRecordsMap = { rec1: makeRecord() };

    expect(resolveCatalogItem('prod-1', TerrainTypes.DTM, {} as unknown as HeightProviders, catalogRecordsMap)).toEqual({
      status: 'not_ready',
    });
  });

  it('returns not_in_catalog when the matching record has no GEOTIFF link', function () {
    const catalogRecordsMap = { rec1: makeRecord({ links: [{ protocol: 'TERRAIN_QMESH', url: 'https://x' }] }) };

    expect(resolveCatalogItem('prod-1', TerrainTypes.DTM, {} as unknown as HeightProviders, catalogRecordsMap)).toEqual({
      status: 'not_in_catalog',
    });
  });

  it('returns not_in_catalog when nothing matches', function () {
    expect(resolveCatalogItem('missing', TerrainTypes.DTM, {} as unknown as HeightProviders, {})).toEqual({ status: 'not_in_catalog' });
  });

  it('returns not_in_catalog for a record whose stored productType is not exactly DSM/DTM', function () {
    const catalogRecordsMap = { rec1: makeRecord({ productType: 'QUANTIZED_MESH_DTM_BEST' }) };
    const heightProviders = { rec1: {} as GeotiffHeightProvider } as unknown as HeightProviders;

    expect(resolveCatalogItem('prod-1', TerrainTypes.DTM, heightProviders, catalogRecordsMap)).toEqual({ status: 'not_in_catalog' });
  });
});
