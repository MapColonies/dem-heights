import { fromUrl } from 'geotiff';
import type { GeoTIFFImage, Pool } from 'geotiff';
import PromisePool from '@supercharge/promise-pool/dist';
import { GeoPoint } from '../interfaces';

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
    private readonly sampleOffset: number,
    private readonly decoderPool?: Pool
  ) {}

  public static async fromUrl(
    url: string,
    headers?: Record<string, string>,
    samplingConcurrency: number = DEFAULT_SAMPLING_CONCURRENCY,
    decoderPool?: Pool
  ): Promise<GeotiffHeightProvider> {
    const tiff = await fromUrl(url, headers ? { headers } : {});
    const image = await tiff.getImage(0);
    const [originX, originY] = image.getOrigin();
    const [pixelWidth, pixelHeight] = image.getResolution();
    const noData = image.getGDALNoData() ?? DEFAULT_NODATA;
    // PixelIsArea (the GeoTIFF default): the origin is the first pixel's outer corner, values sit at pixel centers.
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
      pixelIsPoint ? 0 : HALF_PIXEL,
      decoderPool
    );
  }

  public async sample(points: GeoPoint[]): Promise<(number | null)[]> {
    const heights = new Array<number | null>(points.length).fill(null);

    // One read per internal tile: points in the same tile share a window, so the tile is fetched and decoded once.
    const groups = new Map<string, { index: number; pixel: PixelIndex }[]>();
    points.forEach((point, index) => {
      const pixel = this.locate(point);
      if (pixel === null) {
        return;
      }
      const key = `${Math.floor(pixel.column / this.tileWidth)}:${Math.floor(pixel.row / this.tileHeight)}`;
      const group = groups.get(key) ?? [];
      group.push({ index, pixel });
      groups.set(key, group);
    });

    // Bound concurrent range reads so a large batch doesn't open N simultaneous connections to the gateway.
    await PromisePool.for([...groups.values()])
      .withConcurrency(this.samplingConcurrency)
      .handleError((error) => {
        throw error;
      })
      .process(async (group) => {
        const x0 = Math.min(...group.map(({ pixel }) => pixel.column));
        const y0 = Math.min(...group.map(({ pixel }) => pixel.row));
        const x1 = Math.max(...group.map(({ pixel }) => pixel.column)) + 1;
        const y1 = Math.max(...group.map(({ pixel }) => pixel.row)) + 1;
        const raster = (await this.image.readRasters({ window: [x0, y0, x1, y1], pool: this.decoderPool })) as unknown as number[][];
        const band = raster[0];

        for (const { index, pixel } of group) {
          const value = band[(pixel.row - y0) * (x1 - x0) + (pixel.column - x0)];
          heights[index] = value === this.noData || Number.isNaN(value) ? null : value;
        }
      });

    return heights;
  }

  private locate(point: GeoPoint): PixelIndex | null {
    const fx = (point.longitude - this.originX) / this.pixelWidth - this.sampleOffset;
    const fy = (point.latitude - this.originY) / this.pixelHeight - this.sampleOffset;

    if (!this.isInside(fx, this.rasterWidth) || !this.isInside(fy, this.rasterHeight)) {
      return null;
    }

    // Nearest neighbour: the pixel containing the point.
    return {
      column: Math.min(Math.max(Math.round(fx), 0), this.rasterWidth - 1),
      row: Math.min(Math.max(Math.round(fy), 0), this.rasterHeight - 1),
    };
  }

  // The raster covers half a pixel beyond its outermost sample points.
  private isInside(samplePosition: number, size: number): boolean {
    return samplePosition >= -HALF_PIXEL && samplePosition <= size - HALF_PIXEL;
  }
}
