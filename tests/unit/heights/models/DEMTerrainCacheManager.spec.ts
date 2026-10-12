import config from 'config';
import jsLogger from '@map-colonies/js-logger';
import { PycswDemCatalogRecord } from '@map-colonies/mc-model-types';
import DEMTerrainCacheManager from '../../../../src/heights/models/DEMTerrainCacheManager';
import GeotiffHeightProvider from '../../../../src/heights/models/geotiffHeightProvider';

describe('DEMTerrainCacheManager', () => {
  afterEach(() => jest.restoreAllMocks());

  it('skips a record whose provider fails to open and still registers the rest', async () => {
    const records = [
      { id: 'bad', links: [{ protocol: 'GEOTIFF', url: 'https://gw/cogs/bad.tif' }] },
      { id: 'good', links: [{ protocol: 'GEOTIFF', url: 'https://gw/cogs/good.tif' }] },
    ] as unknown as PycswDemCatalogRecord[];

    const fromUrlSpy = jest
      .spyOn(GeotiffHeightProvider, 'fromUrl')
      .mockRejectedValueOnce(new Error('open failed'))
      .mockResolvedValueOnce({} as GeotiffHeightProvider);

    const logger = jsLogger({ enabled: false });
    const errorSpy = jest.spyOn(logger, 'error');

    const manager = new DEMTerrainCacheManager(config, logger);
    await manager.initProviders(records);

    expect(fromUrlSpy).toHaveBeenCalledTimes(2);
    expect(Object.keys(manager.heightProviders)).toEqual(['good']);
    expect(errorSpy).toHaveBeenCalled();
  });

  it('shares one decoder pool across providers, sized by decoderWorkers', async () => {
    const records = [
      { id: 'a', links: [{ protocol: 'GEOTIFF', url: 'https://gw/cogs/a.tif' }] },
      { id: 'b', links: [{ protocol: 'GEOTIFF', url: 'https://gw/cogs/b.tif' }] },
    ] as unknown as PycswDemCatalogRecord[];
    const fromUrlSpy = jest.spyOn(GeotiffHeightProvider, 'fromUrl').mockResolvedValue({} as GeotiffHeightProvider);

    const manager = new DEMTerrainCacheManager(config, jsLogger({ enabled: false }));
    await manager.initProviders(records);

    const pools = fromUrlSpy.mock.calls.map((call) => call[3]);
    expect(pools[0]).toEqual({ size: config.get<number>('decoderWorkers') });
    expect(pools[1]).toBe(pools[0]);
  });

  it('decodes on the main thread when decoderWorkers is 0', async () => {
    const records = [{ id: 'a', links: [{ protocol: 'GEOTIFF', url: 'https://gw/cogs/a.tif' }] }] as unknown as PycswDemCatalogRecord[];
    const fromUrlSpy = jest.spyOn(GeotiffHeightProvider, 'fromUrl').mockResolvedValue({} as GeotiffHeightProvider);
    const noWorkers = { ...config, get: <T>(key: string): T => (key === 'decoderWorkers' ? 0 : config.get<T>(key)) as T };

    const manager = new DEMTerrainCacheManager(noWorkers as typeof config, jsLogger({ enabled: false }));
    await manager.initProviders(records);

    expect(fromUrlSpy.mock.calls[0][3]).toBeUndefined();
  });
});
