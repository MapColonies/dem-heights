import { Cartographic, CesiumTerrainProvider } from "cesium";

export enum TerrainTypes {
    DSM = "DSM",
    DTM = "DTM"
}

export interface PosWithHeight extends Cartographic {
    update?: string;
    res?: number;
    type?: TerrainTypes;
}

export interface PosWithTerrainProvider extends Cartographic {
    terrainProvider: CesiumTerrainProvider;
    providerKey: string;
}

export type TerrainProviders = Record<string, CesiumTerrainProvider>;