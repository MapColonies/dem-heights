import { inject, injectable } from 'tsyringe';
import { IConfig } from 'config';
import { Logger } from '@map-colonies/js-logger';
import { PycswDemCatalogRecord } from '@map-colonies/mc-model-types';
import { HeightProviders } from '../interfaces';
import { SERVICES } from '../../common/constants';
import GeotiffHeightProvider from './geotiffHeightProvider';

const GEOTIFF_PROTOCOL = 'GEOTIFF';
const COGS_FOLDER = 'cogs/';

@injectable()
export default class DEMTerrainCacheManager {
  public heightProviders: HeightProviders = {};

  public constructor(
    @inject(SERVICES.CONFIG) private readonly config: IConfig,
    @inject(SERVICES.LOGGER) private readonly logger: Logger
  ) {}

  public async initProviders(demCatalogRecords: PycswDemCatalogRecord[]): Promise<void> {
    const heightProviders: HeightProviders = {};

    const geotiffRecords = demCatalogRecords.filter((record) => record.links?.some((link) => link.protocol === GEOTIFF_PROTOCOL));

    for (const record of geotiffRecords) {
      const link = record.links?.find((currentLink) => currentLink.protocol === GEOTIFF_PROTOCOL);
      if (!link) {
        continue;
      }

      try {
        const objectUrl = this.transformRouteToObjectUrl(link.url as string);
        const { url, headers } = this.buildAuthenticatedUrl(objectUrl);
        heightProviders[record.id as string] = await GeotiffHeightProvider.fromUrl(url, headers);
      } catch (err) {
        this.logger.error({
          msg: 'Failed to open geotiff provider; skipping record',
          recordId: record.id,
          err,
          location: '[DEMTerrainCacheManager] [initProviders]',
        });
      }
    }

    this.heightProviders = heightProviders;
  }

  private transformRouteToObjectUrl(linkUrl: string): string {
    const serviceURL = this.config.get<string>('s3Gateway.url');
    const objectKey = linkUrl.split(COGS_FOLDER)[1];
    if (objectKey === undefined) {
      throw new Error(`GEOTIFF link URL missing '${COGS_FOLDER}' segment: ${linkUrl}`);
    }
    return `${serviceURL}/${COGS_FOLDER}${objectKey}`;
  }

  private buildAuthenticatedUrl(objectUrl: string): { url: string; headers?: Record<string, string> } {
    const injectionType = this.config.get<string>('accessToken.injectionType');
    const attributeName = this.config.get<string>('accessToken.attributeName');
    const tokenValue = this.config.get<string>('accessToken.tokenValue');

    if (injectionType.toLowerCase() === 'header') {
      return { url: objectUrl, headers: { [attributeName]: tokenValue } };
    }

    if (injectionType.toLowerCase() === 'queryparam') {
      const separator = objectUrl.includes('?') ? '&' : '?';
      return { url: `${objectUrl}${separator}${attributeName}=${encodeURIComponent(tokenValue)}` };
    }

    return { url: objectUrl };
  }
}
