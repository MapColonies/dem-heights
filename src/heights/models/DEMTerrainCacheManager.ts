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

  public constructor(@inject(SERVICES.CONFIG) private readonly config: IConfig, @inject(SERVICES.LOGGER) private readonly logger: Logger) {}

  public async initProviders(demCatalogRecords: PycswDemCatalogRecord[]): Promise<void> {
    const heightProviders: HeightProviders = {};

    const geotiffRecords = demCatalogRecords.filter((record) => record.links?.some((link) => link.protocol === GEOTIFF_PROTOCOL));
    const samplingConcurrency = Number(this.config.get<number>('samplingConcurrency'));

    for (const record of geotiffRecords) {
      const link = record.links?.find((currentLink) => currentLink.protocol === GEOTIFF_PROTOCOL);
      if (!link) {
        continue;
      }

      try {
        const objectUrl = this.transformRouteToObjectUrl(link.url as string);
        const { url, headers } = this.buildAuthenticatedUrl(objectUrl);
        heightProviders[record.id as string] = await GeotiffHeightProvider.fromUrl(url, headers, samplingConcurrency);
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
    // Take everything from the first 'cogs/' to the end — split()[1] would drop trailing
    // segments if 'cogs/' appears more than once in the URL.
    if (!linkUrl.includes(COGS_FOLDER)) {
      throw new Error(`GEOTIFF link URL missing '${COGS_FOLDER}' segment: ${linkUrl}`);
    }
    const objectKey = linkUrl.slice(linkUrl.indexOf(COGS_FOLDER) + COGS_FOLDER.length);
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
      const url = new URL(objectUrl);
      url.searchParams.set(attributeName, tokenValue);
      return { url: url.toString() };
    }

    return { url: objectUrl };
  }
}
