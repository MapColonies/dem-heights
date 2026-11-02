import type GeotiffHeightProvider from './models/geotiffHeightProvider';

export enum TerrainTypes {
  DSM = 'DSM',
  DTM = 'DTM',
  MIXED = 'MIXED',
}

export interface GeoPoint {
  longitude: number; // WGS84 degrees
  latitude: number; // WGS84 degrees
  height?: number | null;
}

export interface PosWithHeight extends GeoPoint {
  height: number | null;
  productId?: string;
}

export interface PosWithProvider extends GeoPoint {
  providerKey?: string;
}

// MIXED is rejected by the OpenAPI catalogProductTypeEnum, so only DSM/DTM reach here.
export interface CatalogItemSelector {
  productId: string;
  productType: TerrainTypes;
}

export type HeightProviders = Record<string, GeotiffHeightProvider>;
