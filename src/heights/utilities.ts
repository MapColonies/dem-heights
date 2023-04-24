import { Cartographic } from "cesium";
import { PosWithTerrainProvider } from "./interfaces";

export interface PositionsWithProviderKey {
    positions: Cartographic[];
    providerKey: string;
}

export const cartographicArrayClusteringForHeightRequests = (
    positions: PosWithTerrainProvider[],
    maxRequestsPerBatch = 1
): { optimizedCluster: PositionsWithProviderKey[][]; totalRequests: number } => {
    const positionsClustersByTile = new Map<string, Cartographic[]>();

    positions.forEach((pos) => {
        // Get max level for position.
        const maxLevelAtPos = pos.terrainProvider.availability.computeMaximumLevelAtPosition(pos);

        // Get correspond tile.
        const posTile =  pos.terrainProvider.tilingScheme.positionToTileXY(pos, maxLevelAtPos);

        // Create unique key per tile matched.
        const positionTilePath = `${pos.providerKey}_${maxLevelAtPos}_${posTile.x}_${posTile.y}`;

        // Add position to pos array in dictionary
        const currentPosInTile = positionsClustersByTile.get(positionTilePath) ?? [];

        positionsClustersByTile.set(positionTilePath, [...currentPosInTile, pos]);
    });

    // Create batches from clustered positions by max requests per batch.

    const clusteredArray: PositionsWithProviderKey[] = Array.from(positionsClustersByTile).map(([key, val]) => {
        const clusterProviderKey = key.split('_')[0];
       return ({providerKey: clusterProviderKey, positions: val})
    });

    // Concat arrays up to maxRequestsPerBatch per batch

    const newOptimizedCluster: PositionsWithProviderKey[][] = [];

    for (let i = 0; i < clusteredArray.length; i += maxRequestsPerBatch) {
        const sliceCount = Math.min(clusteredArray.length, i + maxRequestsPerBatch);
        const newBatch = clusteredArray.slice(i, sliceCount).flat();
        newOptimizedCluster.push(newBatch);
    }

    return { optimizedCluster: newOptimizedCluster, totalRequests: positionsClustersByTile.size };
};