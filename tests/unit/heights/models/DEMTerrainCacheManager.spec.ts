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
});
