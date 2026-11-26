import { LRUCache } from 'lru-cache';

export type Tile = ArrayLike<number>;

// Decoded tiles under one byte budget, shared by every provider in the process.
export default class TileCache {
  private readonly tiles: LRUCache<string, Tile>;

  public constructor(maxBytes: number) {
    this.tiles = new LRUCache<string, Tile>({ maxSize: maxBytes });
  }

  public get size(): number {
    return this.tiles.calculatedSize;
  }

  public get(key: string): Tile | undefined {
    return this.tiles.get(key);
  }

  // A tile larger than the whole budget is not stored.
  public set(key: string, tile: Tile, bytes: number): void {
    this.tiles.set(key, tile, { size: bytes });
  }
}
