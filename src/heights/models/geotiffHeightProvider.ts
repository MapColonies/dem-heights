import { fromUrl } from 'geotiff';
import type { GeoTIFFImage, Pool } from 'geotiff';
import PromisePool from '@supercharge/promise-pool';
import { GeoPoint } from '../interfaces';
import TileCache, { Tile } from './tileCache';

const DEFAULT_NODATA = -32768;
const DEFAULT_SAMPLING_CONCURRENCY = 16;
const RASTER_PIXEL_IS_POINT = 2;
const HALF_PIXEL = 0.5;

interface PixelIndex {
  column: number;
  row: number;
}

export default class GeotiffHeightProvider {
  private constructor(
    private readonly image: GeoTIFFImage,
    private readonly originX: number,
    private readonly originY: number,
    private readonly pixelWidth: number, // degrees/pixel, positive
    private readonly pixelHeight: number, // degrees/pixel, negative
    private readonly rasterWidth: number,
    private readonly rasterHeight: number,
    private readonly tileWidth: number,
    private readonly tileHeight: number,
    private readonly noData: number,
    private readonly samplingConcurrency: number,
    private readonly cornerOffset: number,
    private readonly cacheKey: string,
    private readonly decoderPool?: Pool,
    private readonly tileCache?: TileCache
  ) {}

  public static async fromUrl(
    url: string,
    headers?: Record<string, string>,
    samplingConcurrency: number = DEFAULT_SAMPLING_CONCURRENCY,
    decoderPool?: Pool,
    tileCache?: TileCache,
    cacheKey: string = url
  ): Promise<GeotiffHeightProvider> {
    const tiff = await fromUrl(url, headers ? { headers } : {});
    const image = await tiff.getImage(0);
    const [originX, originY] = image.getOrigin();
    const [pixelWidth, pixelHeight] = image.getResolution();
    const noData = image.getGDALNoData() ?? DEFAULT_NODATA;
    // PixelIsArea (the GeoTIFF default): the origin is the first pixel's outer corner. PixelIsPoint: it is the first pixel's center.
    const pixelIsPoint = image.getGeoKeys()?.GTRasterTypeGeoKey === RASTER_PIXEL_IS_POINT;

    return new GeotiffHeightProvider(
      image,
      originX,
      originY,
      pixelWidth,
      pixelHeight,
      image.getWidth(),
      image.getHeight(),
      image.getTileWidth(),
      image.getTileHeight(),
      noData,
      samplingConcurrency,
      pixelIsPoint ? HALF_PIXEL : 0,
      cacheKey,
      decoderPool,
      tileCache
    );
  }

  public async sample(points: GeoPoint[]): Promise<(number | null)[]> {
    const heights = new Array<number | null>(points.length).fill(null);

    // One read per internal tile: points in the same tile share it, so the tile is fetched and decoded once.
    const groups = new Map<string, { tileX: number; tileY: number; points: { index: number; pixel: PixelIndex }[] }>();
    points.forEach((point, index) => {
      const pixel = this.locate(point);
      if (pixel === null) {
        return;
      }
      const tileX = Math.floor(pixel.column / this.tileWidth);
      const tileY = Math.floor(pixel.row / this.tileHeight);
      const key = `${tileX}:${tileY}`;
      const group = groups.get(key) ?? { tileX, tileY, points: [] };
      group.points.push({ index, pixel });
      groups.set(key, group);
    });

    // Bound concurrent range reads so a large batch doesn't open N simultaneous connections to the gateway.
    await PromisePool.for([...groups.values()])
      .withConcurrency(this.samplingConcurrency)
      .handleError((error) => {
        throw error;
      })
      .process(async ({ tileX, tileY, points: tilePoints }) => {
        const x0 = tileX * this.tileWidth;
        const y0 = tileY * this.tileHeight;
        const width = Math.min(x0 + this.tileWidth, this.rasterWidth) - x0;
        const tile = await this.readTile(tileX, tileY, x0, y0, width);

        for (const { index, pixel } of tilePoints) {
          const value = tile[(pixel.row - y0) * width + (pixel.column - x0)];
          heights[index] = value === this.noData || Number.isNaN(value) ? null : value;
        }
      });

    return heights;
  }

  private async readTile(tileX: number, tileY: number, x0: number, y0: number, width: number): Promise<Tile> {
    const key = `${this.cacheKey}|${tileX}:${tileY}`;
    const cached = this.tileCache?.get(key);
    if (cached !== undefined) {
      return cached;
    }
    const window = [x0, y0, x0 + width, Math.min(y0 + this.tileHeight, this.rasterHeight)];
    const raster = (await this.image.readRasters({ window, pool: this.decoderPool })) as unknown as Tile[];
    const band = raster[0];
    this.tileCache?.set(key, band, (band as Partial<Float64Array>).byteLength ?? band.length * Float64Array.BYTES_PER_ELEMENT);
    return band;
  }

  private locate(point: GeoPoint): PixelIndex | null {
    // Position in pixels from the raster's outer corner.
    const fx = (point.longitude - this.originX) / this.pixelWidth + this.cornerOffset;
    const fy = (point.latitude - this.originY) / this.pixelHeight + this.cornerOffset;

    if (!this.isInside(fx, this.rasterWidth) || !this.isInside(fy, this.rasterHeight)) {
      return null;
    }

    // Nearest neighbour: the pixel containing the point; a point on the far edge belongs to the last pixel.
    return {
      column: Math.min(Math.floor(fx), this.rasterWidth - 1),
      row: Math.min(Math.floor(fy), this.rasterHeight - 1),
    };
  }

  private isInside(position: number, size: number): boolean {
    return position >= 0 && position <= size;
  }
}
