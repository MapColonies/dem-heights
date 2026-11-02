import crypto from 'crypto';
import { isMatch } from 'lodash';
import { PycswDemCatalogRecord } from '@map-colonies/mc-model-types';
import { GEOTIFF_PROTOCOL } from '../common/constants';
import { HeightProviders, TerrainTypes } from './interfaces';

const FIRST_SYNC_RETRY_DELAY_MS = 5000;
const SYNC_RETRY_BACKOFF_FACTOR = 2;

export const generateChecksum = (str: string, algorithm?: string, encoding?: crypto.BinaryToTextEncoding): string => {
  return crypto
    .createHash(algorithm ?? 'md5')
    .update(str, 'utf8')
    .digest(encoding ?? 'hex');
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const isSame = (src1: any, src2: any): boolean => {
  return generateChecksum(JSON.stringify(src1)) === generateChecksum(JSON.stringify(src2));
};

export const syncRetryDelay = (consecutiveFailures: number, maxDelay: number): number => {
  return Math.min(FIRST_SYNC_RETRY_DELAY_MS * SYNC_RETRY_BACKOFF_FACTOR ** (consecutiveFailures - 1), maxDelay);
};

export function compareCatalogRecordsByResolutionAndDate(recordA: PycswDemCatalogRecord, recordB: PycswDemCatalogRecord): number {
  const A_BEFORE_B = -1;
  const B_BEFORE_A = 1;

  switch (true) {
    case recordA.resolutionMeter! < recordB.resolutionMeter!:
      return A_BEFORE_B;
    case recordA.resolutionMeter! > recordB.resolutionMeter!:
      return B_BEFORE_A;
    default: {
      const dateB = new Date(recordB.updateDate as string | number | Date);
      const dateA = new Date(recordA.updateDate as string | number | Date);
      return dateB.getTime() - dateA.getTime();
    }
  }
}

export type ResolvedCatalogItem =
  | { status: 'ready'; providerKey: string; matchCount: number }
  | { status: 'not_ready' }
  | { status: 'not_in_catalog' };

// Exact match: a stored 'QUANTIZED_MESH_DTM_BEST' does not match 'DTM' (MAPCO-12427).
export function resolveCatalogItem(
  productId: string,
  productType: TerrainTypes,
  heightProviders: HeightProviders,
  catalogRecordsMap: Record<string, PycswDemCatalogRecord>
): ResolvedCatalogItem {
  const selector = { productId, productType };

  const readyKeys = Object.keys(heightProviders).filter((key) => isMatch(catalogRecordsMap[key], selector));
  if (readyKeys.length > 0) {
    const [bestKey] = readyKeys.sort((a, b) => compareCatalogRecordsByResolutionAndDate(catalogRecordsMap[a], catalogRecordsMap[b]));
    return { status: 'ready', providerKey: bestKey, matchCount: readyKeys.length };
  }

  const catalogMatchKey = Object.keys(catalogRecordsMap).find((key) => isMatch(catalogRecordsMap[key], selector));
  if (catalogMatchKey === undefined) {
    return { status: 'not_in_catalog' };
  }

  const hasGeotiffLink = catalogRecordsMap[catalogMatchKey].links?.some((link) => link.protocol === GEOTIFF_PROTOCOL) ?? false;
  return hasGeotiffLink ? { status: 'not_ready' } : { status: 'not_in_catalog' };
}
