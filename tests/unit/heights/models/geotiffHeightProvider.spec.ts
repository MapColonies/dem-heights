import GeotiffHeightProvider from '../../../../src/heights/models/geotiffHeightProvider';

jest.mock('geotiff', () => ({
  fromUrl: jest.fn(),
}));

// eslint-disable-next-line @typescript-eslint/no-var-requires
const { fromUrl } = require('geotiff') as { fromUrl: jest.Mock };

// origin [34,33], resolution [0.001,-0.001], 100x100, nodata -32768
const makeImage = (band: number[], nodata: number | null = -32768) => ({
  getOrigin: () => [34.0, 33.0, 0],
  getResolution: () => [0.001, -0.001],
  getWidth: () => 100,
  getHeight: () => 100,
  getGDALNoData: () => nodata,
  readRasters: jest.fn().mockResolvedValue([Int16Array.from(band)]),
});

const mockTiff = (image: unknown): void => {
  fromUrl.mockResolvedValue({ getImage: jest.fn().mockResolvedValue(image) });
};

describe('GeotiffHeightProvider', () => {
  afterEach(() => jest.clearAllMocks());

  it('bilinearly interpolates the height at a point', async () => {
    // point at pixel (0,0)+0.5 in both axes → center of the 2x2 window
    mockTiff(makeImage([200, 202, 204, 206]));
    const provider = await GeotiffHeightProvider.fromUrl('http://gw/cogs/x.tif');

    const [height] = await provider.sample([{ longitude: 34.0005, latitude: 32.9995 }]);

    expect(height).toBeCloseTo(203, 5);
  });

  it('returns null when any neighbor is nodata', async () => {
    mockTiff(makeImage([200, -32768, 204, 206]));
    const provider = await GeotiffHeightProvider.fromUrl('http://gw/cogs/x.tif');

    const [height] = await provider.sample([{ longitude: 34.0005, latitude: 32.9995 }]);

    expect(height).toBeNull();
  });

  it('returns null for a point outside the raster', async () => {
    mockTiff(makeImage([200, 202, 204, 206]));
    const provider = await GeotiffHeightProvider.fromUrl('http://gw/cogs/x.tif');

    const [height] = await provider.sample([{ longitude: 10.0, latitude: 10.0 }]);

    expect(height).toBeNull();
  });

  it('passes token headers through to fromUrl', async () => {
    mockTiff(makeImage([1, 1, 1, 1]));
    await GeotiffHeightProvider.fromUrl('http://gw/cogs/x.tif', { 'x-api-key': 'T' });

    expect(fromUrl).toHaveBeenCalledWith('http://gw/cogs/x.tif', { headers: { 'x-api-key': 'T' } });
  });
});
