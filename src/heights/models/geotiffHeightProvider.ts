import { fromUrl } from 'geotiff';
import type { GeoTIFFImage } from 'geotiff';
import PromisePool from '@supercharge/promise-pool/dist';
import { GeoPoint } from '../interfaces';

const DEFAULT_NODATA = -32768;
const DEFAULT_SAMPLING_CONCURRENCY = 16;
const RASTER_PIXEL_IS_POINT = 2;
const HALF_PIXEL = 0.5;

export default class GeotiffHeightProvider {
  private constructor(
    private readonly image: GeoTIFFImage,
    private readonly originX: number,
    private readonly originY: number,
    private readonly pixelWidth: number, // degrees/pixel, positive
    private readonly pixelHeight: number, // degrees/pixel, negative
    private readonly rasterWidth: number,
    private readonly rasterHeight: number,
    private readonly noData: number,
    private readonly samplingConcurrency: number,
    private readonly sampleOffset: number
  ) {}

  public static async fromUrl(
    url: string,
    headers?: Record<string, string>,
    samplingConcurrency: number = DEFAULT_SAMPLING_CONCURRENCY
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
      noData,
      samplingConcurrency,
      pixelIsPoint ? 0 : HALF_PIXEL
    );
  }

  public async sample(points: GeoPoint[]): Promise<(number | null)[]> {
    // Bound concurrent range reads so a large batch doesn't open N simultaneous connections to the gateway.
    const heights = new Array<number | null>(points.length);
    await PromisePool.for(points.map((point, index) => ({ point, index })))
      .withConcurrency(this.samplingConcurrency)
      .handleError((error) => {
        throw error;
      })
      .process(async ({ point, index }) => {
        heights[index] = await this.sampleOne(point);
      });
    return heights;
  }

  private async sampleOne(point: GeoPoint): Promise<number | null> {
    const fx = (point.longitude - this.originX) / this.pixelWidth - this.sampleOffset;
    const fy = (point.latitude - this.originY) / this.pixelHeight - this.sampleOffset;

    if (!this.isInside(fx, this.rasterWidth) || !this.isInside(fy, this.rasterHeight)) {
      return null;
    }

    // Nearest neighbour: the pixel containing the point.
    const column = Math.min(Math.max(Math.round(fx), 0), this.rasterWidth - 1);
    const row = Math.min(Math.max(Math.round(fy), 0), this.rasterHeight - 1);

    const raster = (await this.image.readRasters({ window: [column, row, column + 1, row + 1] })) as unknown as number[][];
    const [value] = raster[0];

    return value === this.noData || Number.isNaN(value) ? null : value;
  }

  // The raster covers half a pixel beyond its outermost sample points.
  private isInside(samplePosition: number, size: number): boolean {
    return samplePosition >= -HALF_PIXEL && samplePosition <= size - HALF_PIXEL;
  }
}
