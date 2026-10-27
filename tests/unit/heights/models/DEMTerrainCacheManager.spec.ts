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

  it('registers a provider for every geotiff record', async () => {
    const records = [
      { id: 'a', links: [{ protocol: 'GEOTIFF', url: 'https://gw/cogs/a.tif' }] },
      { id: 'b', links: [{ protocol: 'GEOTIFF', url: 'https://gw/cogs/b.tif' }] },
      { id: 'c', links: [{ protocol: 'GEOTIFF', url: 'https://gw/cogs/c.tif' }] },
    ] as unknown as PycswDemCatalogRecord[];

    jest.spyOn(GeotiffHeightProvider, 'fromUrl').mockResolvedValue({} as GeotiffHeightProvider);

    const manager = new DEMTerrainCacheManager(config, jsLogger({ enabled: false }));
    await manager.initProviders(records);

    expect(Object.keys(manager.heightProviders).sort((first, second) => first.localeCompare(second))).toEqual(['a', 'b', 'c']);
  });
});
