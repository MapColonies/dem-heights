import { Cartographic, CesiumTerrainProvider } from "cesium";

export enum TerrainTypes {
    DSM = "DSM",
    DTM = "DTM",
    MIXED = "MIXED",
}

export enum AdditionalFieldsEnum {
    PRODUCT_TYPE = 'productType',
    UPDATE_DATE = 'updateDate',
    RESOLUTION_METER = 'resolutionMeter',
}

export interface PosWithHeight extends Cartographic {
    updateDate?: string;
    resolutionMeter?: number;
    productType?: TerrainTypes;
}

export interface PosWithTerrainProvider extends Cartographic {
    terrainProvider: CesiumTerrainProvider;
    providerKey: string;
}

export type TerrainProviders = Record<string, CesiumTerrainProvider>;