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
    private readonly cornerOffset: number
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
      noData,
      samplingConcurrency,
      pixelIsPoint ? HALF_PIXEL : 0
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
    // Position in pixels from the raster's outer corner.
    const fx = (point.longitude - this.originX) / this.pixelWidth + this.cornerOffset;
    const fy = (point.latitude - this.originY) / this.pixelHeight + this.cornerOffset;

    if (!this.isInside(fx, this.rasterWidth) || !this.isInside(fy, this.rasterHeight)) {
      return null;
    }

    // Nearest neighbour: the pixel containing the point; a point on the far edge belongs to the last pixel.
    const column = Math.min(Math.floor(fx), this.rasterWidth - 1);
    const row = Math.min(Math.floor(fy), this.rasterHeight - 1);

    const raster = (await this.image.readRasters({ window: [column, row, column + 1, row + 1] })) as unknown as number[][];
    const [value] = raster[0];

    return value === this.noData || Number.isNaN(value) ? null : value;
  }

  private isInside(position: number, size: number): boolean {
    return position >= 0 && position <= size;
  }
}
