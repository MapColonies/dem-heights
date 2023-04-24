import { Cartographic, TerrainProvider } from "cesium";

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
    terrainProvider: TerrainProvider;
    providerKey: string;
}

export type TerrainProviders = Record<string, TerrainProvider>;