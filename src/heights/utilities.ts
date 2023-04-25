/* eslint-disable import/exports-last */

import { Cartographic } from "cesium";
import { PosWithTerrainProvider } from "./interfaces";

export interface PositionsWithProviderKey {
    positions: Cartographic[];
    providerKey: string;
}

export interface BatchedPositionsWithProviderKey {
    positions: Cartographic[][];
    providerKey: string;
}


const createClustersByTerrainProvider = (
    data: PositionsWithProviderKey[],
    maxRequestsPerBatch: number
): BatchedPositionsWithProviderKey[] => {
    const clusters = new Map<string, Cartographic[][]>();

    // Group positions by providerKey and split into subArrays
    for (const item of data) {
        const positions = item.positions;
        const subArrays = clusters.get(item.providerKey) ?? [];
        for (let j = 0; j < positions.length; j += maxRequestsPerBatch) {
            const subarray = positions.slice(
                j,
                Math.min(j + maxRequestsPerBatch, positions.length)
            );
            
            subArrays.push(subarray.map(({latitude, longitude}) => ({latitude, longitude} as Cartographic)));
            
        }
        clusters.set(item.providerKey, subArrays);
    }

    // Create a new object for each provider with the corresponding subarrays of positions
    const result: BatchedPositionsWithProviderKey[] = [];
    for (const [providerKey, positions] of clusters) {
        result.push({ providerKey, positions });
    }

    return result;
};


export const cartographicArrayClusteringForHeightRequests = (
    positions: PosWithTerrainProvider[],
    maxRequestsPerBatch = 1
): { optimizedCluster: BatchedPositionsWithProviderKey[]; totalRequests: number } => {
    const positionsClustersByTile = new Map<string, Cartographic[]>();

    positions.forEach((pos) => {
        // Get max level for position.
        const maxLevelAtPos = pos.terrainProvider.availability.computeMaximumLevelAtPosition(pos);

        // Get correspond tile.
        const posTile = pos.terrainProvider.tilingScheme.positionToTileXY(pos, maxLevelAtPos);

        // Create unique key per tile matched.
        const positionTilePath = `${pos.providerKey}_${maxLevelAtPos}_${posTile.x}_${posTile.y}`;

        // Add position to pos array in dictionary
        const currentPosInTile = positionsClustersByTile.get(positionTilePath) ?? [];

        positionsClustersByTile.set(positionTilePath, [...currentPosInTile, pos]);
    });

    // Create batches of length up to max requests, by provider.

    const clusteredPositionsWithProviderKey: PositionsWithProviderKey[] = Array.from(
        positionsClustersByTile
    ).map(([key, val]) => {
        const clusterProviderKey = key.split("_")[0];
        return { providerKey: clusterProviderKey, positions: val };
    });

    const newOptimizedCluster = createClustersByTerrainProvider(clusteredPositionsWithProviderKey, maxRequestsPerBatch);

    return { optimizedCluster: newOptimizedCluster, totalRequests: positionsClustersByTile.size };
};