import config from 'config';
import jsLogger from '@map-colonies/js-logger';
import { PycswDemCatalogRecord } from '@map-colonies/mc-model-types';
import { CswClientWrapper } from '../../../../src/common/csw/cswClientWrapper';
import { CatalogSyncManager } from '../../../../src/heights/models/catalogSyncManager';
import { CatalogRecords } from '../../../../src/heights/models/catalogRecords';
import DEMTerrainCacheManager from '../../../../src/heights/models/DEMTerrainCacheManager';

const RECORDS = [{ id: 'r1', links: [{ protocol: 'GEOTIFF', url: 'https://gw/cogs/r1.tif' }] }] as unknown as PycswDemCatalogRecord[];

function makeCacheManager(): { cacheManager: DEMTerrainCacheManager; initProviders: jest.Mock } {
  const initProviders = jest.fn().mockResolvedValue(undefined);
  return { cacheManager: { initProviders } as unknown as DEMTerrainCacheManager, initProviders };
}

describe('CatalogSyncManager', () => {
  let manager: CatalogSyncManager | undefined;

  afterEach(() => {
    manager?.stop();
    manager = undefined;
    jest.restoreAllMocks();
    jest.useRealTimers();
  });

  it('fetches records, updates the cache, and rebuilds providers on first run', async () => {
    jest.spyOn(CswClientWrapper.prototype, 'getRecords').mockResolvedValue(RECORDS);
    const catalogRecords = new CatalogRecords();
    const { cacheManager, initProviders } = makeCacheManager();

    manager = new CatalogSyncManager(config, jsLogger({ enabled: false }));
    manager.start(catalogRecords, cacheManager);
    await new Promise((resolve) => setImmediate(resolve));

    expect(Object.keys(catalogRecords.getValue())).toEqual(['r1']);
    expect(initProviders).toHaveBeenCalledWith(RECORDS);
  });

  it('does not rebuild providers when the fetched records are unchanged', async () => {
    jest.spyOn(CswClientWrapper.prototype, 'getRecords').mockResolvedValue(RECORDS);
    const catalogRecords = new CatalogRecords();
    catalogRecords.setValue(Object.fromEntries(RECORDS.map((r) => [r.id as string, r])));
    const { cacheManager, initProviders } = makeCacheManager();

    manager = new CatalogSyncManager(config, jsLogger({ enabled: false }));
    manager.start(catalogRecords, cacheManager);
    await new Promise((resolve) => setImmediate(resolve));

    expect(initProviders).not.toHaveBeenCalled();
  });

  it('logs and survives a fetch error without throwing', async () => {
    jest.spyOn(CswClientWrapper.prototype, 'getRecords').mockRejectedValue(new Error('csw down'));
    const logger = jsLogger({ enabled: false });
    const errorSpy = jest.spyOn(logger, 'error');
    const { cacheManager, initProviders } = makeCacheManager();

    manager = new CatalogSyncManager(config, logger);
    manager.start(new CatalogRecords(), cacheManager);
    await new Promise((resolve) => setImmediate(resolve));

    expect(errorSpy).toHaveBeenCalled();
    expect(initProviders).not.toHaveBeenCalled();
  });

  it('schedules the next run with the configured interval after a cycle completes', async () => {
    const setTimeoutSpy = jest.spyOn(global, 'setTimeout');
    jest.spyOn(CswClientWrapper.prototype, 'getRecords').mockResolvedValue(RECORDS);
    const interval = config.get<number>('synchRecordsInterval');

    manager = new CatalogSyncManager(config, jsLogger({ enabled: false }));
    manager.start(new CatalogRecords(), makeCacheManager().cacheManager);
    await new Promise((resolve) => setImmediate(resolve));

    const scheduledWithInterval = setTimeoutSpy.mock.calls.filter((call) => call[1] === interval);
    expect(scheduledWithInterval.length).toBeGreaterThanOrEqual(1);
  });

  it('stop() clears the pending timer so no further run is scheduled', async () => {
    jest.spyOn(CswClientWrapper.prototype, 'getRecords').mockResolvedValue(RECORDS);
    const clearTimeoutSpy = jest.spyOn(global, 'clearTimeout');

    manager = new CatalogSyncManager(config, jsLogger({ enabled: false }));
    manager.start(new CatalogRecords(), makeCacheManager().cacheManager);
    await new Promise((resolve) => setImmediate(resolve));
    manager.stop();

    expect(clearTimeoutSpy).toHaveBeenCalled();
  });

  it('reschedules the next run even after a fetch error', async () => {
    const setTimeoutSpy = jest.spyOn(global, 'setTimeout');
    jest.spyOn(CswClientWrapper.prototype, 'getRecords').mockRejectedValue(new Error('csw down'));
    const interval = config.get<number>('synchRecordsInterval');

    manager = new CatalogSyncManager(config, jsLogger({ enabled: false }));
    manager.start(new CatalogRecords(), makeCacheManager().cacheManager);
    await new Promise((resolve) => setImmediate(resolve));

    const scheduledWithInterval = setTimeoutSpy.mock.calls.filter((call) => call[1] === interval);
    expect(scheduledWithInterval.length).toBeGreaterThanOrEqual(1);
  });
});
