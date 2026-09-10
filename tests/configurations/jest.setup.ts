import 'reflect-metadata';

// geotiff ships a nested ESM-only quick-lru that Jest's CJS runtime cannot parse.
// Mock the module so the real graph never loads; tests stub provider behavior directly.
jest.mock('geotiff', () => ({ fromUrl: jest.fn() }));
