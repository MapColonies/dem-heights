export type Tile = ArrayLike<number>;

// Least-recently-used decoded tiles under one byte budget, shared by every provider in the process.
export default class TileCache {
  private readonly tiles = new Map<string, { tile: Tile; bytes: number }>();
  private usedBytes = 0;

  public constructor(private readonly maxBytes: number) {}

  public get(key: string): Tile | undefined {
    const entry = this.tiles.get(key);
    if (entry === undefined) {
      return undefined;
    }
    // Map keeps insertion order, so re-inserting marks the entry most recently used.
    this.tiles.delete(key);
    this.tiles.set(key, entry);
    return entry.tile;
  }

  public set(key: string, tile: Tile, bytes: number): void {
    if (bytes > this.maxBytes) {
      return;
    }
    this.delete(key);
    this.tiles.set(key, { tile, bytes });
    this.usedBytes += bytes;
    for (const oldest of this.tiles.keys()) {
      if (this.usedBytes <= this.maxBytes) {
        break;
      }
      this.delete(oldest);
    }
  }

  public get size(): number {
    return this.usedBytes;
  }

  private delete(key: string): void {
    const entry = this.tiles.get(key);
    if (entry !== undefined) {
      this.usedBytes -= entry.bytes;
      this.tiles.delete(key);
    }
  }
}
