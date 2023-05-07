import { BBox } from 'geojson';

export interface ICatalog {
  getCoverageId: (bbox: BBox) => Promise<string>;
}

export const CATALOG_SYMBOL = Symbol('ICatalog');