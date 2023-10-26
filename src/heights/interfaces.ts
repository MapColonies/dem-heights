import { Cartographic, CesiumTerrainProvider } from 'cesium';

export enum TerrainTypes {
  DSM = 'DSM',
  DTM = 'DTM',
  MIXED = 'MIXED',
}

export interface PosWithHeight extends Cartographic {
  productId: string;
}

export interface PosWithTerrainProvider extends Cartographic {
  terrainProvider?: CesiumTerrainProvider;
  providerKey?: string;
}

export type TerrainProviders = Record<string, CesiumTerrainProvider>;
