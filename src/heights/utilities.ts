/* eslint-disable import/exports-last */

import crypto from 'crypto';
import { Cartographic } from 'cesium';
import { PosWithTerrainProvider } from './interfaces';

export interface PositionsWithProviderKey {
  positions: Cartographic[];
  providerKey: string | null;
}

const NO_PROVIDER_KEY = 'NO-PROVIDER';

// eslint-disable-next-line @typescript-eslint/naming-convention
const createClustersByTerrainProvider = (data: PositionsWithProviderKey[], maxRequestsPerBatch: number): PositionsWithProviderKey[] => {
  const clusters: (PositionsWithProviderKey & { count: number })[] = [];

  // Group positions by providerKey and split into subArrays
  for (let i = 0; i < data.length; i++) {
    const item = data[i];
    const positions = item.positions;
    const batchedPos = clusters.find((value) => value.providerKey === item.providerKey && value.count < maxRequestsPerBatch);
    if (batchedPos) {
      batchedPos.positions.push(...positions);
      batchedPos.count++;
    } else {
      clusters.push({ providerKey: item.providerKey === NO_PROVIDER_KEY ? null : item.providerKey, positions, count: 1 });
    }
  }

  // @ts-ignore
  return clusters;
};

export const cartographicArrayClusteringForHeightRequests = (
  positions: PosWithTerrainProvider[],
  maxRequestsPerBatch = 1
): { optimizedCluster: PositionsWithProviderKey[]; totalRequests: number } => {
  const positionsClustersByTile = new Map<string, Cartographic[]>();

  positions.forEach((pos) => {
    // Check if position doesn't have attached terrain provider
    if (typeof pos.terrainProvider === 'undefined' || typeof pos.providerKey === 'undefined') {
      const positionTilePath = NO_PROVIDER_KEY;

      const currentPosInTile = positionsClustersByTile.get(positionTilePath) ?? [];

      positionsClustersByTile.set(positionTilePath, [
        ...currentPosInTile,
        { latitude: pos.latitude, longitude: pos.longitude, height: null } as unknown as Cartographic,
      ]);

      return;
    }

    // Get max level for position.
    const maxLevelAtPos = pos.terrainProvider.availability.computeMaximumLevelAtPosition(pos);

    // Get correspond tile.
    const posTile = pos.terrainProvider.tilingScheme.positionToTileXY(pos, maxLevelAtPos);

    // Create unique key per tile matched.
    const positionTilePath = `${pos.providerKey}_${maxLevelAtPos}_${posTile.x}_${posTile.y}`;

    // Add position to pos array in dictionary
    const currentPosInTile = positionsClustersByTile.get(positionTilePath) ?? [];

    positionsClustersByTile.set(positionTilePath, [...currentPosInTile, { latitude: pos.latitude, longitude: pos.longitude } as Cartographic]);
  });

  // Create batches of length up to max requests, by provider.

  const clusteredPositionsWithProviderKey: PositionsWithProviderKey[] = Array.from(positionsClustersByTile).map(([key, val]) => {
    const clusterProviderKey = key.split('_')[0];
    return { providerKey: clusterProviderKey, positions: val };
  });

  const newOptimizedCluster = createClustersByTerrainProvider(clusteredPositionsWithProviderKey, maxRequestsPerBatch);

  const totalRequests = positionsClustersByTile.size - +positionsClustersByTile.has(NO_PROVIDER_KEY);

  return { optimizedCluster: newOptimizedCluster, totalRequests: totalRequests };
};

export const generateChecksum = (str: string, algorithm?: string, encoding?: crypto.BinaryToTextEncoding) => {
  return crypto
    .createHash(algorithm || 'md5')
    .update(str, 'utf8')
    .digest(encoding || 'hex');
};

export const isSame = (src1: any, src2: any) => {
  return generateChecksum(JSON.stringify(src1)) === generateChecksum(JSON.stringify(src2));
};
