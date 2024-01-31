import { inject, injectable } from 'tsyringe';
import { IConfig } from 'config';
import { CesiumTerrainProvider, Resource } from 'cesium';
import { PycswDemCatalogRecord } from '@map-colonies/mc-model-types';
import { TerrainProviders } from '../interfaces';
import { SERVICES } from '../../common/constants';

const QMESH_PROTOCOL = 'TERRAIN_QMESH';
const TERRAINS_FOLDER = 'terrains/';

@injectable()
export default class DEMTerrainCacheManager {
  public terrainProviders: TerrainProviders = {};
  public constructor(@inject(SERVICES.CONFIG) private readonly config: IConfig) {}

  private transformRouteToService(cswUrl: string) {
    const serviceURL = this.config.get<string>('s3Gateway.url');

    return `${serviceURL}/${TERRAINS_FOLDER}${cswUrl.split(TERRAINS_FOLDER)[1]}`;
  }

  private getTokenResource(url: string): Resource {
    const tokenProps: Record<string, unknown> = { url };

    const injectionType = this.config.get<string>('accessToken.injectionType');
    const attributeName = this.config.get<string>('accessToken.attributeName');
    const tokenValue = this.config.get<string>('accessToken.tokenValue');

    if (injectionType && injectionType.toLowerCase() === 'header') {
      tokenProps.headers = {
        [attributeName]: tokenValue,
      } as Record<string, unknown>;
    } else if (injectionType && injectionType.toLowerCase() === 'queryparam') {
      tokenProps.queryParameters = {
        [attributeName]: tokenValue,
      } as Record<string, unknown>;
    }

    return new Resource({ ...(tokenProps as unknown as Resource) });
  }

  public async initTerrainProviders(demCatalogRecords: PycswDemCatalogRecord[]): Promise<void> {
    const terrainProviders: TerrainProviders = {};

    const qmeshRecords = demCatalogRecords.filter((record) => {
      return record.links?.some((link) => link.protocol === QMESH_PROTOCOL);
    });

    for (const record of qmeshRecords) {
      const recordProviderLink = record.links?.find((link) => link.protocol === QMESH_PROTOCOL);

      if (recordProviderLink) {
        const provider = await CesiumTerrainProvider.fromUrl(this.getTokenResource(this.transformRouteToService(recordProviderLink.url as string)));

        terrainProviders[record.id as string] = provider;
      }
    }

    this.terrainProviders = terrainProviders;
  }
}
