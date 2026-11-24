export interface TileRange {
  minX: number;
  maxX: number;
  minY: number;
  maxY: number;
}

export function tileCount(range: TileRange): number {
  return (range.maxX - range.minX) * (range.maxY - range.minY);
}

export function pageOf<T>(items: T[], page: number, pageSize: number): T[] {
  const start = page * pageSize;
  return items.slice(start, start + pageSize + 1);
}

export function averageHeight(heights: number[]): number {
  return heights.reduce((sum, h) => sum + h, 0) / heights.length;
}
