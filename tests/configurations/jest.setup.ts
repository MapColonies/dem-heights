import 'reflect-metadata';

// geotiff ships a nested ESM-only quick-lru that Jest's CJS runtime cannot parse.
// Mock the module so the real graph never loads; tests stub provider behavior directly.
// eslint-disable-next-line @typescript-eslint/naming-convention
jest.mock('geotiff', () => ({ fromUrl: jest.fn(), Pool: jest.fn().mockImplementation((size: number) => ({ size })) }));
