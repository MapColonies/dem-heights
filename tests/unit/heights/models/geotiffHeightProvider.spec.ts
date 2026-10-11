import GeotiffHeightProvider from '../../../../src/heights/models/geotiffHeightProvider';

jest.mock('geotiff', () => ({
  fromUrl: jest.fn(),
}));

// eslint-disable-next-line @typescript-eslint/no-var-requires
const { fromUrl } = require('geotiff') as { fromUrl: jest.Mock };

const NODATA = -32768;
const SIZE = 100;
const RES = 0.001;
const PIXEL_IS_AREA = 1;
const PIXEL_IS_POINT = 2;

// Linear in column and row, so bilinear interpolation is exact: height = 100 * row + column.
const linearGrid = (column: number, row: number): number => 100 * row + column;

// origin [34,33], resolution [0.001,-0.001], 100x100
const makeImage = (grid: (column: number, row: number) => number = linearGrid, rasterType: number | null = PIXEL_IS_AREA) => ({
  getOrigin: () => [34.0, 33.0, 0],
  getResolution: () => [RES, -RES],
  getWidth: () => SIZE,
  getHeight: () => SIZE,
  getGDALNoData: () => NODATA,
  // eslint-disable-next-line @typescript-eslint/naming-convention
  getGeoKeys: () => (rasterType === null ? null : { GTRasterTypeGeoKey: rasterType }),
  readRasters: jest.fn(async ({ window: [x0, y0, x1, y1] }: { window: number[] }) => {
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

  it('returns the pixel value at a pixel center', async () => {
    const provider = await providerFor(makeImage());

    const [height] = await provider.sample([at(5.5, 7.5)]);

    expect(height).toBeCloseTo(linearGrid(5, 7), 6);
  });

  it('interpolates between pixel centers', async () => {
    const provider = await providerFor(makeImage());

    const [corner, offCenter] = await provider.sample([at(6, 8), at(5.75, 7.6)]);

    expect(corner).toBeCloseTo((linearGrid(5, 7) + linearGrid(6, 7) + linearGrid(5, 8) + linearGrid(6, 8)) / 4, 6);
    expect(offCenter).toBeCloseTo(100 * 7.1 + 5.25, 6);
  });

  it('treats a raster without GeoKeys as PixelIsArea', async () => {
    const provider = await providerFor(makeImage(linearGrid, null));

    const [height] = await provider.sample([at(5.5, 7.5)]);

    expect(height).toBeCloseTo(linearGrid(5, 7), 6);
  });

  it('samples PixelIsPoint rasters at the grid points', async () => {
    const provider = await providerFor(makeImage(linearGrid, PIXEL_IS_POINT));

    const [height] = await provider.sample([at(5, 7)]);

    expect(height).toBeCloseTo(linearGrid(5, 7), 6);
  });

  it('clamps to the edge pixels within half a pixel of the raster edge', async () => {
    const image = makeImage();
    const provider = await providerFor(image);

    const [left, right, bottom] = await provider.sample([at(0.2, 7.5), at(SIZE - 0.2, 7.5), at(5.5, SIZE - 0.1)]);

    expect(left).toBeCloseTo(linearGrid(0, 7), 6);
    expect(right).toBeCloseTo(linearGrid(SIZE - 1, 7), 6);
    expect(bottom).toBeCloseTo(linearGrid(5, SIZE - 1), 6);
    const windows = image.readRasters.mock.calls.map(([options]) => options.window);
    expect(windows).toContainEqual([SIZE - 2, 7, SIZE, 9]);
  });

  it('returns null for a point outside the raster', async () => {
    const provider = await providerFor(makeImage());

    const heights = await provider.sample([at(-0.1, 7.5), at(SIZE + 0.1, 7.5), at(5.5, -0.1), { longitude: 10.0, latitude: 10.0 }]);

    expect(heights).toEqual([null, null, null, null]);
  });

  it('returns null only when a contributing neighbor is nodata', async () => {
    const provider = await providerFor(makeImage((column, row) => (column === 6 && row === 7 ? NODATA : linearGrid(column, row))));

    const [center, between] = await provider.sample([at(5.5, 7.5), at(6, 8)]);

    expect(center).toBeCloseTo(linearGrid(5, 7), 6);
    expect(between).toBeNull();
  });

  it('passes token headers through to fromUrl', async () => {
    fromUrl.mockResolvedValue({ getImage: jest.fn().mockResolvedValue(makeImage()) });
    // eslint-disable-next-line @typescript-eslint/naming-convention
    await GeotiffHeightProvider.fromUrl('http://gw/cogs/x.tif', { 'x-api-key': 'T' });

    // eslint-disable-next-line @typescript-eslint/naming-convention
    expect(fromUrl).toHaveBeenCalledWith('http://gw/cogs/x.tif', { headers: { 'x-api-key': 'T' } });
  });
});
