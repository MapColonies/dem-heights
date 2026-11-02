import { PycswDemCatalogRecord } from '@map-colonies/mc-model-types';
import { HeightProviders, TerrainTypes } from '../../../src/heights/interfaces';
import GeotiffHeightProvider from '../../../src/heights/models/geotiffHeightProvider';
import {
  compareCatalogRecordsByResolutionAndDate,
  generateChecksum,
  isSame,
  resolveCatalogItem,
  syncRetryDelay,
} from '../../../src/heights/utilities';

describe('utilities', () => {
  describe('generateChecksum', () => {
    it('is deterministic for the same input', () => {
      expect(generateChecksum('abc')).toEqual(generateChecksum('abc'));
    });
    it('differs for different input', () => {
      expect(generateChecksum('abc')).not.toEqual(generateChecksum('abd'));
    });
  });

  describe('isSame', () => {
    it('returns true for deeply equal objects', () => {
      expect(isSame({ a: 1, b: [2, 3] }, { a: 1, b: [2, 3] })).toBe(true);
    });
    it('returns false for different objects', () => {
      expect(isSame({ a: 1 }, { a: 2 })).toBe(false);
    });
  });

  describe('syncRetryDelay', () => {
    it('doubles the delay with each consecutive failure', () => {
      expect([1, 2, 3, 4].map((failures) => syncRetryDelay(failures, 600000))).toEqual([5000, 10000, 20000, 40000]);
    });
    it('never exceeds the sync interval', () => {
      expect(syncRetryDelay(20, 600000)).toBe(600000);
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

    it('ignores a loaded provider that has no catalog record', function () {
      const heightProviders = { orphan: {} as GeotiffHeightProvider } as unknown as HeightProviders;

      expect(resolveCatalogItem('prod-1', TerrainTypes.DTM, heightProviders, {})).toEqual({ status: 'not_in_catalog' });
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
});
