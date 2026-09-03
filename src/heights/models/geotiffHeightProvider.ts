import { fromUrl } from 'geotiff';
import type { GeoTIFFImage } from 'geotiff';
import { GeoPoint } from '../interfaces';

const DEFAULT_NODATA = -32768;

export default class GeotiffHeightProvider {
  private constructor(
    private readonly image: GeoTIFFImage,
    private readonly originX: number,
    private readonly originY: number,
    private readonly pixelWidth: number, // degrees/pixel, positive
    private readonly pixelHeight: number, // degrees/pixel, negative
    private readonly rasterWidth: number,
    private readonly rasterHeight: number,
    private readonly noData: number
  ) {}

  public static async fromUrl(url: string, headers?: Record<string, string>): Promise<GeotiffHeightProvider> {
    const tiff = await fromUrl(url, headers ? { headers } : {});
    const image = await tiff.getImage(0);
    const [originX, originY] = image.getOrigin();
    const [pixelWidth, pixelHeight] = image.getResolution();
    const noData = image.getGDALNoData() ?? DEFAULT_NODATA;

    return new GeotiffHeightProvider(image, originX, originY, pixelWidth, pixelHeight, image.getWidth(), image.getHeight(), noData);
  }

  public async sample(points: GeoPoint[]): Promise<(number | null)[]> {
    return Promise.all(points.map(async (point) => this.sampleOne(point)));
  }

  private async sampleOne(point: GeoPoint): Promise<number | null> {
    const fx = (point.longitude - this.originX) / this.pixelWidth;
    const fy = (point.latitude - this.originY) / this.pixelHeight;
    const px = Math.floor(fx);
    const py = Math.floor(fy);

    // Need a full 2x2 neighborhood for bilinear interpolation.
    if (px < 0 || py < 0 || px >= this.rasterWidth - 1 || py >= this.rasterHeight - 1) {
      return null;
    }

    const dx = fx - px;
    const dy = fy - py;

    const raster = (await this.image.readRasters({ window: [px, py, px + 2, py + 2] })) as unknown as number[][];
    const band = raster[0];
    const [tl, tr, bl, br] = [band[0], band[1], band[2], band[3]];

    if ([tl, tr, bl, br].some((value) => value === this.noData || Number.isNaN(value))) {
      return null;
    }

    const top = tl + (tr - tl) * dx;
    const bottom = bl + (br - bl) * dx;

    return top + (bottom - top) * dy;
  }
}
