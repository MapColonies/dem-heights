import GeotiffHeightProvider from '../../../../src/heights/models/geotiffHeightProvider';

jest.mock('geotiff', () => ({
  fromUrl: jest.fn(),
}));

// eslint-disable-next-line @typescript-eslint/no-var-requires
const { fromUrl } = require('geotiff') as { fromUrl: jest.Mock };

const NODATA = -32768;
const SIZE = 100;
const TILE = 16;
const RES = 0.001;
const PIXEL_IS_AREA = 1;
const PIXEL_IS_POINT = 2;

// A distinct value per pixel.
const linearGrid = (column: number, row: number): number => 100 * row + column;

const makeImage = (
  grid: (column: number, row: number) => number = linearGrid,
  rasterType: number | null = PIXEL_IS_AREA,
  width = SIZE,
  height = SIZE
) => ({
  getOrigin: () => [34.0, 33.0, 0],
  getResolution: () => [RES, -RES],
  getWidth: () => width,
  getHeight: () => height,
  getTileWidth: () => TILE,
  getTileHeight: () => TILE,
  getGDALNoData: () => NODATA,
  // eslint-disable-next-line @typescript-eslint/naming-convention
  getGeoKeys: () => (rasterType === null ? null : { GTRasterTypeGeoKey: rasterType }),
  readRasters: jest.fn(async ({ window: [x0, y0, x1, y1] }: { window: number[] }) => {
    if (x0 < 0 || y0 < 0 || x1 > width || y1 > height) {
      throw new Error(`window [${x0},${y0},${x1},${y1}] outside ${width}x${height} raster`);
    }
    const band: number[] = [];
    for (let row = y0; row < y1; row++) {
      for (let column = x0; column < x1; column++) {
        band.push(grid(column, row));
      }
    }
    return Promise.resolve([band]);
  }),
});

const providerFor = async (image: ReturnType<typeof makeImage>): Promise<GeotiffHeightProvider> => {
  fromUrl.mockResolvedValue({ getImage: jest.fn().mockResolvedValue(image) });
  return GeotiffHeightProvider.fromUrl('http://gw/cogs/x.tif');
};

// Point at fractional pixel position (column, row) measured from the raster's outer corner.
const at = (column: number, row: number): { longitude: number; latitude: number } => ({
  longitude: 34.0 + column * RES,
  latitude: 33.0 - row * RES,
});

describe('GeotiffHeightProvider', () => {
  afterEach(() => jest.clearAllMocks());

  describe.each([
    { name: 'PixelIsArea', rasterType: PIXEL_IS_AREA, sampleOffset: 0.5 },
    { name: 'PixelIsPoint', rasterType: PIXEL_IS_POINT, sampleOffset: 0 },
    { name: 'no GeoKeys (defaults to PixelIsArea)', rasterType: null, sampleOffset: 0.5 },
  ])('$name', ({ rasterType, sampleOffset }) => {
    // Point at fractional sample-grid position (column, row): integers land where pixel values sit.
    const atSample = (column: number, row: number): { longitude: number; latitude: number } => at(column + sampleOffset, row + sampleOffset);
    const image = (grid?: (column: number, row: number) => number): ReturnType<typeof makeImage> => makeImage(grid, rasterType);

    it('returns the pixel value at its sample point', async () => {
      const provider = await providerFor(image());

      const [height] = await provider.sample([atSample(5, 7)]);

      expect(height).toBeCloseTo(linearGrid(5, 7), 6);
    });

    it('returns the containing pixel value anywhere inside the pixel', async () => {
      const provider = await providerFor(image());

      const heights = await provider.sample([atSample(5.4, 7.4), atSample(4.6, 6.6), atSample(5.6, 7.6), atSample(5.002, 6.995)]);

      expect(heights).toEqual([linearGrid(5, 7), linearGrid(5, 7), linearGrid(6, 8), linearGrid(5, 7)]);
    });

    it('clamps to the edge pixels within half a pixel of the raster edge', async () => {
      const edgeImage = image();
      const provider = await providerFor(edgeImage);

      const heights = await provider.sample([atSample(-0.3, 7), atSample(SIZE - 0.7, 7.4), atSample(5, SIZE - 0.6)]);

      expect(heights).toEqual([linearGrid(0, 7), linearGrid(SIZE - 1, 7), linearGrid(5, SIZE - 1)]);
      const windows = edgeImage.readRasters.mock.calls.map(([options]) => options.window);
      expect(windows).toContainEqual([SIZE - 1, 7, SIZE, 8]);
    });

    it('returns null for a point outside the raster', async () => {
      const provider = await providerFor(image());

      const heights = await provider.sample([atSample(-0.6, 7), atSample(SIZE - 0.4, 7), atSample(5, -0.6), { longitude: 10.0, latitude: 10.0 }]);

      expect(heights).toEqual([null, null, null, null]);
    });

    it('returns null only when the containing pixel is nodata', async () => {
      const provider = await providerFor(image((column, row) => (column === 6 && row === 7 ? NODATA : linearGrid(column, row))));

      const [nextToNodata, onNodata] = await provider.sample([atSample(5.45, 7), atSample(5.55, 7)]);

      expect(nextToNodata).toBe(linearGrid(5, 7));
      expect(onNodata).toBeNull();
    });
  });

  it('samples a single-pixel raster', async () => {
    const provider = await providerFor(makeImage(() => 42, PIXEL_IS_AREA, 1, 1));

    const heights = await provider.sample([at(0.5, 0.5), at(0.1, 0.9), at(1.1, 0.5)]);

    expect(heights).toEqual([42, 42, null]);
  });

  it('samples a raster one pixel wide', async () => {
    const provider = await providerFor(makeImage(linearGrid, PIXEL_IS_AREA, 1, SIZE));

    const heights = await provider.sample([at(0.3, 8.4), at(0.9, 8.6)]);

    expect(heights).toEqual([linearGrid(0, 8), linearGrid(0, 8)]);
  });

  it('samples a raster one pixel tall', async () => {
    const provider = await providerFor(makeImage(linearGrid, PIXEL_IS_AREA, SIZE, 1));

    const heights = await provider.sample([at(8.4, 0.3), at(8.6, 0.9)]);

    expect(heights).toEqual([linearGrid(8, 0), linearGrid(8, 0)]);
  });

  it('reads each internal tile once per call', async () => {
    const image = makeImage();
    const provider = await providerFor(image);
    // Three points in tile (0,0), including its last column, and two in tile (1,0).
    const points = [at(1.5, 1.5), at(3.2, 7.9), at(15.9, 4.2), at(17.5, 1.5), at(20.1, 5.5)];

    const heights = await provider.sample(points);

    expect(image.readRasters).toHaveBeenCalledTimes(2);
    expect(heights).toEqual([linearGrid(1, 1), linearGrid(3, 7), linearGrid(15, 4), linearGrid(17, 1), linearGrid(20, 5)]);
  });

  it('does not read for points outside the raster', async () => {
    const image = makeImage();
    const provider = await providerFor(image);

    const heights = await provider.sample([at(-1, 5), at(5, SIZE + 1)]);

    expect(heights).toEqual([null, null]);
    expect(image.readRasters).not.toHaveBeenCalled();
  });

  it('decodes through the given pool', async () => {
    const image = makeImage();
    fromUrl.mockResolvedValue({ getImage: jest.fn().mockResolvedValue(image) });
    const pool = {};
    const provider = await GeotiffHeightProvider.fromUrl('http://gw/cogs/x.tif', undefined, undefined, pool as never);

    await provider.sample([at(5.5, 7.5)]);

    expect(image.readRasters).toHaveBeenCalledWith(expect.objectContaining({ pool }));
  });

  it('passes token headers through to fromUrl', async () => {
    fromUrl.mockResolvedValue({ getImage: jest.fn().mockResolvedValue(makeImage()) });
    // eslint-disable-next-line @typescript-eslint/naming-convention
    await GeotiffHeightProvider.fromUrl('http://gw/cogs/x.tif', { 'x-api-key': 'T' });

    // eslint-disable-next-line @typescript-eslint/naming-convention
    expect(fromUrl).toHaveBeenCalledWith('http://gw/cogs/x.tif', { headers: { 'x-api-key': 'T' } });
  });
});
