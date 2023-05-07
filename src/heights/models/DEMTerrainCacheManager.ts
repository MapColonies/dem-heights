import { inject, singleton } from "tsyringe";
import { IConfig } from "config";
import { CesiumTerrainProvider, IonResource, Resource } from "cesium";
import { PycswDemCatalogRecord } from "@map-colonies/mc-model-types";
import { TerrainProviders } from "../interfaces";
import { SERVICES } from "../../common/constants";

const QMESH_PROTOCOL = "TERRAIN_QMESH";

@singleton()
export default class DEMTerrainCacheManager {
    private terrains!: TerrainProviders;

    public constructor(@inject(SERVICES.CONFIG) private readonly config: IConfig) {
        this.setTerrainProviders();
    }

    public get terrainProviders(): TerrainProviders {
        return this.terrains;
    }

    public set terrainProviders(providers: TerrainProviders) {
        this.terrains = providers;
    }

    private setTerrainProviders(): void {
        const demCatalogRecords = JSON.parse(this.config.get<string>("demCatalogRecords")) as PycswDemCatalogRecord[];

        const terrainProviders: TerrainProviders = {};

        demCatalogRecords
            .filter((record) => {
                return record.links?.some((link) => link.protocol === QMESH_PROTOCOL);
            })
            .forEach((record) => {
                // Real logic
                
                const recordProviderLink = record.links?.find(
                    (link) => link.protocol === QMESH_PROTOCOL
                );

                if(recordProviderLink) {
                    // const provider = CesiumTerrainProvider.fromUrl(new Resource({
                    //     url: recordProviderLink.url as string,
                    //     queryParameters: {
                    //         token: this.config.get<string>('terrainProvidersToken')
                    //     }
                    // })).then((p) => {
                    //     terrainProviders[record.id as string] = p;

                    // })
                    
                    
                    // Cesium provider
                    const provider: CesiumTerrainProvider = new CesiumTerrainProvider({
                            url: IonResource.fromAssetId(1, {
                                    accessToken:
                                        "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJqdGkiOiI5NDAxMTYyNC1lMzUwLTRkYzEtOWRkNC1kMjVkNjYwNWJjNTUiLCJpZCI6MTM1MDQ4LCJpYXQiOjE2ODIxNjIyMTl9.PvD5p7C_HyAp-JfTs1yKab4c3n_vYstn0AeD0qx_REg"
                                })
                            });
                            
                            terrainProviders[record.id as string] = provider;
                    }
            });

            this.terrainProviders = terrainProviders;
    }
}
