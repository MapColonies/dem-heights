import { inject, injectable } from "tsyringe";
import { IConfig } from "config";
import { CesiumTerrainProvider, IonResource, Resource } from "cesium";
import { PycswDemCatalogRecord } from "@map-colonies/mc-model-types";
import { TerrainProviders } from "../interfaces";
import { SERVICES } from "../../common/constants";

const QMESH_PROTOCOL = "TERRAIN_QMESH";

@injectable()
export default class DEMTerrainCacheManager {
    public terrainProviders: TerrainProviders = {};
    private readonly isTestMode: boolean;
    public constructor(@inject(SERVICES.CONFIG) private readonly config: IConfig) {
        this.isTestMode = config.get<boolean>('isTestMode');
    }

    public async initTerrainProviders(): Promise<void> {
        const demCatalogRecords = JSON.parse(
            this.config.get<string>("demCatalogRecords")
        ) as PycswDemCatalogRecord[];

        const terrainProviders: TerrainProviders = {};

        const qmeshRecords = demCatalogRecords
            .filter((record) => {
                return record.links?.some((link) => link.protocol === QMESH_PROTOCOL);
            });
            

        for (const record of qmeshRecords) {

            if(this.isTestMode) {
                // Cesium provider              
                const provider: CesiumTerrainProvider = await CesiumTerrainProvider.fromUrl(IonResource.fromAssetId(1, {
                    accessToken: this.config.get("cesiumIONTerrainProviderToken")
                }))

                terrainProviders[record.id as string] = provider;
                continue;
            }
            
            const recordProviderLink = record.links?.find(
                (link) => link.protocol === QMESH_PROTOCOL
            );

            if (recordProviderLink) {
                const provider = await CesiumTerrainProvider.fromUrl(
                    new Resource({
                        url: recordProviderLink.url as string,
                        queryParameters: {
                            token: this.config.get<string>("terrainProvidersToken")
                        }
                    })
                );

                terrainProviders[record.id as string] = provider;
            }
        }

        this.terrainProviders = terrainProviders;
    }
}
