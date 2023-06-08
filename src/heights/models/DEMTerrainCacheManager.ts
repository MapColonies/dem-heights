import { inject, injectable } from "tsyringe";
import { IConfig } from "config";
import { CesiumTerrainProvider, Resource } from "cesium";
import { PycswDemCatalogRecord } from "@map-colonies/mc-model-types";
import { TerrainProviders } from "../interfaces";
import { SERVICES } from "../../common/constants";

const QMESH_PROTOCOL = "TERRAIN_QMESH";

@injectable()
export default class DEMTerrainCacheManager {
    public terrainProviders: TerrainProviders = {};
    public constructor(@inject(SERVICES.CONFIG) private readonly config: IConfig) {}

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
