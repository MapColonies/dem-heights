# GeoTIFF Heights Migration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the Cesium quantized-mesh terrain engine in `dem-heights` with direct COG (Cloud-Optimized GeoTIFF) sampling read over HTTP range requests from the S3 gateway, keeping the `/points` API contract identical.

**Architecture:** Positions flow as WGS84 **degrees** end-to-end (no more radians round-trip). Discovery stays on CSW but filters for a `GEOTIFF` link instead of `TERRAIN_QMESH`. `DEMTerrainCacheManager` opens one `GeotiffHeightProvider` per catalog record via `geotiff.js` `fromUrl` (range reads through the gateway, token auth). `HeightsManager` selects a provider per point (product-type + footprint + resolution), groups points by provider, and samples heights via bilinear interpolation, mapping the tiff nodata value (`-32768`) and out-of-footprint points to `null`. Cesium is removed entirely.

**Tech Stack:** TypeScript (CommonJS build, `target es2021`), Node 20, Express, tsyringe DI, `geotiff@^3.0.5` (ships a CJS entry — plain `import` works), `@turf/boolean-point-in-polygon`, Jest 28, `config`.

---

## Background facts (verified before this plan)

- Cesium coupling lives in: `DEMTerrainCacheManager.ts`, `heightsManager.ts`, `utilities.ts`, `interfaces.ts`, plus the two radian middlewares (`dataToRadians.ts`, `dataToDegrees.ts`) and their consumers (`controller`, `validateRequest`, `router`, tests).
- The radian middlewares exist ONLY because Cesium works in radians. GeoTIFF geotransform math is in degrees, so both middlewares and `radiansToOriginalPositionsMap` are deleted.
- Live env (verified on OCP `dem-dev`): `nginx-s3-gateway` proxies S3 **Range** (`206`/`Content-Range`), OPA auth passes with token as **queryParam** `?token=`. COGs already uploaded at MinIO bucket `dem-dev` under prefix `cogs/`. geotiff.js `fromUrl` through the internal gateway opened + sampled a real COG (`206.99 m`).
- Use the `tiled_ovr` COG (native 30 m, tiled 256, 13 overviews) — NOT the coarse `_COG` variant.
- Tiff nodata = `-32768` on all GEO tiffs.
- Catalog `productType` values look like `QUANTIZED_MESH_DTM_BEST`; selection uses `.includes('DTM'|'DSM')`, so it keeps working regardless of exact string.

## File Structure

**Create**
- `src/heights/models/geotiffHeightProvider.ts` — opens a COG and samples heights (bilinear + nodata). One responsibility: raster → height.
- `tests/unit/heights/models/geotiffHeightProvider.spec.ts` — unit tests for sampling math via a mocked `geotiff` module.

**Modify**
- `src/heights/interfaces.ts` — drop Cesium types; add `GeoPoint`, `PosWithProvider`, `HeightProviders`; keep `TerrainTypes`, `PosWithHeight`.
- `src/heights/models/DEMTerrainCacheManager.ts` — build `GeotiffHeightProvider`s from `GEOTIFF` links (filename + DI symbol unchanged to limit churn).
- `src/heights/models/heightsManager.ts` — provider selection in degrees, group-by-provider, bilinear sampling; remove Cesium + tile clustering + density throw.
- `src/heights/utilities.ts` — delete tile-clustering; keep `generateChecksum` + `isSame`.
- `src/workerCatalogRecords.ts` — CSW filter `TERRAIN_QMESH` → `GEOTIFF`.
- `src/containerConfig.ts` — call `initProviders` (renamed) instead of `initTerrainProviders`.
- `src/heights/controllers/heightsController.ts` — request positions typed `GeoPoint[]`; drop `radiansToOriginalPositionsMap`.
- `src/heights/middlewares/validateRequest.ts` — type `GeoPoint[]`; drop Cesium import.
- `src/heights/routes/heightsRouter.ts` — remove the two radian middlewares from the chain.
- `package.json` — remove `cesium`, add `geotiff`.
- `tests/configurations/jest.setup.ts` — remove the global `jest.mock('cesium', ...)` (mocked `sampleTerrainMostDetailed`, now obsolete); keep only `import 'reflect-metadata';`. Runs before EVERY unit + integration spec, so it must be de-cesium'd or all specs fail to load. (Handled during Task 3, since it blocks Task 3's own spec.)
- `tests/configurations/testContainerConfig.ts` — records use `GEOTIFF` links; mock `GeotiffHeightProvider.fromUrl`.
- `tests/unit/heights/models/heightModel.spec.ts` — degrees input; mock geotiff provider.
- `tests/unit/heights/middlewares/heightsMiddlewares.spec.ts` — remove radian/degree middleware tests.
- `tests/integration/heights/heights.spec.ts` — remove Cesium spy.

**Delete**
- `src/heights/middlewares/dataToRadians.ts`
- `src/heights/middlewares/dataToDegrees.ts`

## Conventions for every task

- Run a single unit spec: `npx jest --config=./tests/configurations/unit/jest.config.js <path-or-pattern>`
- Run all unit: `npm run test:unit`
- Run integration: `npm run test:integration`
- Type-check/build: `npm run build`
- Lint fix: `npm run lint:fix`
- Node must be 20: `nvm use 20` first (config@3.3.7 crashes on Node 24).
- Commit after each task. Conventional Commits: this migration is `feat:`/`refactor:`; dependency swap is `build:` (per repo convention, NOT `chore:`). End commit messages with the two trailer lines required by the repo (Co-Authored-By + Claude-Session).

---

### Task 1: Add geotiff dependency, remove cesium

**Files:**
- Modify: `package.json`

- [ ] **Step 1: Swap the dependency**

Run:
```bash
nvm use 20
npm uninstall cesium
npm install geotiff@^3.0.5
```

- [ ] **Step 2: Verify geotiff resolves as CJS**

Run: `node -e "console.log(typeof require('geotiff').fromUrl)"`
Expected: `function`

- [ ] **Step 3: Verify cesium is gone from the tree**

Run: `node -e "try{require('cesium');console.log('STILL PRESENT')}catch(e){console.log('removed')}"`
Expected: `removed`

- [ ] **Step 4: Commit**

```bash
git add package.json package-lock.json
git commit -m "build: replace cesium terrain engine with geotiff"
```

---

### Task 2: New coordinate + provider types

**Files:**
- Modify: `src/heights/interfaces.ts`

- [ ] **Step 1: Replace the file contents**

```typescript
import type GeotiffHeightProvider from './models/geotiffHeightProvider';

export enum TerrainTypes {
  DSM = 'DSM',
  DTM = 'DTM',
  MIXED = 'MIXED',
}

export interface GeoPoint {
  longitude: number; // WGS84 degrees
  latitude: number; // WGS84 degrees
  height?: number | null;
}

export interface PosWithHeight extends GeoPoint {
  height: number | null;
  productId?: string;
}

export interface PosWithProvider extends GeoPoint {
  providerKey?: string;
}

export type HeightProviders = Record<string, GeotiffHeightProvider>;
```

- [ ] **Step 2: Expect type errors elsewhere (fine for now)**

Run: `npx tsc --noEmit -p tsconfig.json || true`
Expected: errors only in files that still import removed symbols (`PosWithTerrainProvider`, `TerrainProviders`, `cesium`). These are fixed in later tasks. The type import of `GeotiffHeightProvider` will error until Task 3 creates the file — that is expected.

- [ ] **Step 3: Commit**

```bash
git add src/heights/interfaces.ts
git commit -m "refactor: degrees-based GeoPoint and height provider types"
```

---

### Task 3: GeotiffHeightProvider — sampling engine (TDD)

**Files:**
- Create: `src/heights/models/geotiffHeightProvider.ts`
- Test: `tests/unit/heights/models/geotiffHeightProvider.spec.ts`

- [ ] **Step 1: Write the failing test**

```typescript
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
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx jest --config=./tests/configurations/unit/jest.config.js geotiffHeightProvider`
Expected: FAIL — `Cannot find module '.../geotiffHeightProvider'`.

- [ ] **Step 3: Create the implementation**

```typescript
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

    if ([tl, tr, bl, br].some((value) => value === this.noData)) {
      return null;
    }

    const top = tl + (tr - tl) * dx;
    const bottom = bl + (br - bl) * dx;

    return top + (bottom - top) * dy;
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx jest --config=./tests/configurations/unit/jest.config.js geotiffHeightProvider`
Expected: PASS (4 tests).

- [ ] **Step 5: Commit**

```bash
git add src/heights/models/geotiffHeightProvider.ts tests/unit/heights/models/geotiffHeightProvider.spec.ts
git commit -m "feat: geotiff COG height provider with bilinear sampling"
```

---

### Task 4: DEMTerrainCacheManager builds geotiff providers

**Files:**
- Modify: `src/heights/models/DEMTerrainCacheManager.ts`

Rationale for keeping the filename and DI symbol: the symbol is only an injection token; keeping both avoids churn across `containerConfig.ts` and every test import.

- [ ] **Step 1: Replace the file contents**

```typescript
import { inject, injectable } from 'tsyringe';
import { IConfig } from 'config';
import { PycswDemCatalogRecord } from '@map-colonies/mc-model-types';
import { HeightProviders } from '../interfaces';
import { SERVICES } from '../../common/constants';
import GeotiffHeightProvider from './geotiffHeightProvider';

const GEOTIFF_PROTOCOL = 'GEOTIFF';
const COGS_FOLDER = 'cogs/';

@injectable()
export default class DEMTerrainCacheManager {
  public heightProviders: HeightProviders = {};

  public constructor(@inject(SERVICES.CONFIG) private readonly config: IConfig) {}

  public async initProviders(demCatalogRecords: PycswDemCatalogRecord[]): Promise<void> {
    const heightProviders: HeightProviders = {};

    const geotiffRecords = demCatalogRecords.filter((record) => record.links?.some((link) => link.protocol === GEOTIFF_PROTOCOL));

    for (const record of geotiffRecords) {
      const link = record.links?.find((currentLink) => currentLink.protocol === GEOTIFF_PROTOCOL);

      if (link) {
        const objectUrl = this.transformRouteToObjectUrl(link.url as string);
        const { url, headers } = this.buildAuthenticatedUrl(objectUrl);
        heightProviders[record.id as string] = await GeotiffHeightProvider.fromUrl(url, headers);
      }
    }

    this.heightProviders = heightProviders;
  }

  private transformRouteToObjectUrl(linkUrl: string): string {
    const serviceURL = this.config.get<string>('s3Gateway.url');

    return `${serviceURL}/${COGS_FOLDER}${linkUrl.split(COGS_FOLDER)[1]}`;
  }

  private buildAuthenticatedUrl(objectUrl: string): { url: string; headers?: Record<string, string> } {
    const injectionType = this.config.get<string>('accessToken.injectionType');
    const attributeName = this.config.get<string>('accessToken.attributeName');
    const tokenValue = this.config.get<string>('accessToken.tokenValue');

    if (injectionType.toLowerCase() === 'header') {
      return { url: objectUrl, headers: { [attributeName]: tokenValue } };
    }

    if (injectionType.toLowerCase() === 'queryparam') {
      const separator = objectUrl.includes('?') ? '&' : '?';
      return { url: `${objectUrl}${separator}${attributeName}=${encodeURIComponent(tokenValue)}` };
    }

    return { url: objectUrl };
  }
}
```

- [ ] **Step 2: Update the DI wiring caller**

In `src/containerConfig.ts`, change the one call inside the worker `updateValue` handler from:
```typescript
            await demTerrainCacheManager.initTerrainProviders(dataValue);
```
to:
```typescript
            await demTerrainCacheManager.initProviders(dataValue);
```

- [ ] **Step 3: Build to type-check these two files**

Run: `npm run build`
Expected: `heightsManager.ts` still errors (fixed next task); `DEMTerrainCacheManager.ts` and `containerConfig.ts` compile clean.

- [ ] **Step 4: Commit**

```bash
git add src/heights/models/DEMTerrainCacheManager.ts src/containerConfig.ts
git commit -m "feat: open geotiff providers from GEOTIFF catalog links"
```

---

### Task 5: HeightsManager samples via geotiff (TDD)

**Files:**
- Modify: `src/heights/models/heightsManager.ts`
- Modify: `tests/configurations/testContainerConfig.ts`
- Modify: `tests/unit/heights/models/heightModel.spec.ts`

- [ ] **Step 1: Update the test container to GEOTIFF links and mock the provider**

In `tests/configurations/testContainerConfig.ts`:

1. Add imports at the top (after existing imports):
```typescript
import GeotiffHeightProvider from '../../src/heights/models/geotiffHeightProvider';
```

2. In BOTH catalog records, change the `links` entry `protocol` and `url`:
```typescript
      links: [
        {
          __typename: 'Link',
          name: '',
          description: '',
          protocol: 'GEOTIFF',
          url: 'https://tiles-dev.mapcolonies.net/api/dem/v1/cogs/combined_srtm_30_100_il_ever.tif',
        },
      ],
```
(For the second record use `.../cogs/srtm100.tif`.)

3. Immediately before the `await (async ...)` IIFE, install the provider mock so `initProviders` does not hit the network:
```typescript
  jest.spyOn(GeotiffHeightProvider, 'fromUrl').mockResolvedValue({
    sample: async (points: { longitude: number; latitude: number }[]) => points.map(() => 100),
  } as unknown as GeotiffHeightProvider);
```

4. Change the init call:
```typescript
    if (shouldInitTerrainProviders) {
      await demTestTerrainCacheManager.initProviders(demTestCatalogRecords as unknown as PycswDemCatalogRecord[]);
    }
```

- [ ] **Step 2: Rewrite the model unit test for degrees input**

Replace the entire contents of `tests/unit/heights/models/heightModel.spec.ts`:

```typescript
import { container } from 'tsyringe';
import { HeightsManager } from '../../../../src/heights/models/heightsManager';
import mockJsonPoints, { positionsOutsideOfProviders, emptyPositionsRequest } from '../../../../src/heights/MOCKS/mockData';
import { GetHeightsPointsRequest } from '../../../../src/heights/controllers/heightsController';
import { PosWithHeight, TerrainTypes } from '../../../../src/heights/interfaces';
import { registerTestValues } from '../../../configurations/testContainerConfig';

describe('Get Heights model', function () {
  const mockJsonData = mockJsonPoints as GetHeightsPointsRequest;
  const mockJsonDataOutOfBounds = positionsOutsideOfProviders as GetHeightsPointsRequest;

  let heightsManager: HeightsManager;

  beforeEach(async function () {
    await registerTestValues();
    heightsManager = container.resolve(HeightsManager);
  });

  afterEach(() => {
    container.reset();
    container.clearInstances();
    jest.clearAllMocks();
  });

  describe('Given valid parameters', function () {
    it('Should return positions with height and productId', async function () {
      const result = await heightsManager.getPoints(mockJsonData.positions, TerrainTypes.MIXED);

      expect(result).toHaveLength(mockJsonData.positions.length);
      for (const position of result) {
        expect(position.height).toBe(100);
        expect(position.productId).toBeDefined();
      }
    });

    it('Should return null heights and no productId when no provider matches the product type', async function () {
      const result = await heightsManager.getPoints(mockJsonData.positions, TerrainTypes.DSM);

      expect(result).toHaveLength(mockJsonData.positions.length);
      for (const position of result) {
        expect(position.height).toBeNull();
        expect(position.productId).toBeUndefined();
      }
    });

    it('Should return height only for the positions inside a provider footprint', async function () {
      const result = await heightsManager.getPoints(mockJsonDataOutOfBounds.positions, TerrainTypes.MIXED);

      expect(result).toHaveLength(mockJsonDataOutOfBounds.positions.length);
      for (const position of result) {
        expect(position.longitude).toBeDefined();
        expect(position.latitude).toBeDefined();

        const isNullHeight = (position.height as number | null) === null;
        expect(typeof position.productId === 'undefined').toEqual(isNullHeight);
      }
    });
  });

  describe('Given invalid params', function () {
    it('Should return empty array for empty positions', async function () {
      await expect(heightsManager.getPoints((emptyPositionsRequest as unknown as GetHeightsPointsRequest).positions, TerrainTypes.MIXED)).resolves.toEqual([]);
    });
  });
});
```

Note: `mockData.ts` already exports plain `{ longitude, latitude }` objects (degrees), so no `Cartographic.fromDegrees` conversion is needed anymore.

- [ ] **Step 3: Run the test to verify it fails**

Run: `npx jest --config=./tests/configurations/unit/jest.config.js heightModel`
Expected: FAIL — `heightsManager.ts` still imports `cesium`/`sampleTerrainMostDetailed`; compile/runtime error.

- [ ] **Step 4: Rewrite `heightsManager.ts`**

Replace the entire contents of `src/heights/models/heightsManager.ts`:

```typescript
import { Polygon } from 'geojson';
import client from 'prom-client';
import { container, inject, injectable } from 'tsyringe';
import { Logger } from '@map-colonies/js-logger';
import PromisePool from '@supercharge/promise-pool/dist';
import booleanPointInPolygon from '@turf/boolean-point-in-polygon';
import { Feature } from '@turf/turf';
import { CommonErrors } from '../../common/commonErrors';
import { SERVICES } from '../../common/constants';
import { IConfig } from '../../common/interfaces';
import { CATALOG_RECORDS_MAP, DEM_TERRAIN_CACHE_MANAGER } from '../../containerConfig';
import { GeoPoint, PosWithHeight, PosWithProvider, TerrainTypes } from '../interfaces';
import DEMTerrainCacheManager from './DEMTerrainCacheManager';
import { CatalogRecords } from './catalogRecords';

export interface ICoordinates {
  longitude: string;
  latitude: string;
}

export interface IHeightModel {
  dem: number;
}

@injectable()
export class HeightsManager {
  private runningRequests = 0;

  private get catalogRecordsMap() {
    return container.resolve<CatalogRecords>(CATALOG_RECORDS_MAP).getValue();
  }

  private get heightProviders() {
    return container.resolve<DEMTerrainCacheManager>(DEM_TERRAIN_CACHE_MANAGER).heightProviders;
  }

  private readonly elevationsRequestsCounter?: client.Counter<'points_number'>;

  public constructor(
    @inject(SERVICES.LOGGER) private readonly logger: Logger,
    @inject(CommonErrors) private readonly commonErrors: CommonErrors,
    @inject(SERVICES.CONFIG) private readonly config: IConfig,
    @inject(SERVICES.METRICS_REGISTRY) registry?: client.Registry
  ) {
    if (registry !== undefined) {
      // eslint-disable-next-line @typescript-eslint/no-this-alias
      const self = this;
      new client.Gauge({
        name: 'elevations_current_requests_count',
        help: 'Currently running elevations requests',
        collect(): void {
          this.set(self.runningRequests);
        },
        registers: [registry],
      });

      this.elevationsRequestsCounter = new client.Counter({
        name: 'elevations_requests_total',
        help: 'Total elevations requests',
        labelNames: ['points_number'] as const,
        registers: [registry],
      });
    }
  }

  public async getPoints(points: GeoPoint[], requestedProductType: TerrainTypes, reqCtx?: Record<string, unknown>): Promise<PosWithHeight[]> {
    this.logger.info({ pointsNumber: points.length, location: '[HeightsManager] [getPoints]', ...reqCtx });

    this.runningRequests++;
    // eslint-disable-next-line @typescript-eslint/naming-convention
    this.elevationsRequestsCounter?.inc({ points_number: points.length });

    if (points.length === 0) {
      this.runningRequests--;
      return [];
    }

    const result = await this.samplePositionsHeights(points, requestedProductType, reqCtx);

    this.logger.info({
      totalRequests: result.totalRequests,
      pointsNumber: points.length,
      location: '[HeightsManager] [getPoints]',
      ...reqCtx,
    });

    this.runningRequests--;
    return result.positions;
  }

  private async samplePositionsHeights(
    positionsArr: GeoPoint[],
    requestedProductType: TerrainTypes,
    reqCtx?: Record<string, unknown>
  ): Promise<{ positions: PosWithHeight[]; totalRequests: number }> {
    const attachProviderStart = performance.now();
    const positionsWithProviders = this.attachProviderToPositions(positionsArr, requestedProductType);
    this.logger.info({
      attachProviderTime: performance.now() - attachProviderStart,
      pointsNumber: positionsArr.length,
      location: '[HeightsManager] [samplePositionsHeights]',
      ...reqCtx,
    });

    // Group points by the provider chosen for them (null = no provider).
    const groups = new Map<string | null, GeoPoint[]>();
    for (const position of positionsWithProviders) {
      const key = position.providerKey ?? null;
      const bucket = groups.get(key) ?? [];
      bucket.push({ longitude: position.longitude, latitude: position.latitude });
      groups.set(key, bucket);
    }

    const groupEntries = [...groups.entries()];
    const finalPositionsWithHeights: PosWithHeight[] = [];

    const { results } = await PromisePool.for(groupEntries)
      .withConcurrency(Math.max(1, groupEntries.length))
      .process(async ([providerKey, points]) => {
        if (providerKey === null) {
          return points.map((point) => ({ ...point, height: null } as PosWithHeight));
        }

        const samplingStart = performance.now();
        const provider = this.heightProviders[providerKey];
        const record = this.catalogRecordsMap[providerKey];
        const heights = await provider.sample(points);

        this.logger.info({
          terrainSamplingTime: performance.now() - samplingStart,
          providerId: providerKey,
          pointsNumber: positionsArr.length,
          location: '[HeightsManager] [samplePositionsHeights]',
          ...reqCtx,
        });

        return points.map((point, index) => {
          const height = heights[index];
          return {
            ...point,
            height,
            ...(height !== null ? { productId: record.productId as string } : {}),
          } as PosWithHeight;
        });
      });

    finalPositionsWithHeights.push(...(results as PosWithHeight[][]).flat());

    return { positions: finalPositionsWithHeights, totalRequests: groupEntries.length };
  }

  private attachProviderToPositions(positions: GeoPoint[], requestedProductType: TerrainTypes): PosWithProvider[] {
    /*
     * Filter providers by requested product type (unless MIXED)
     * Filter providers by footprint point intersection
     * Sort by highest resolution (lower resolutionMeter is better), tie-break on newest updateDate
     * Attach the best provider key to the point
     */
    return positions.map((position) => {
      const providerEntries = Object.entries(this.heightProviders);

      const productTypeFiltered =
        requestedProductType !== TerrainTypes.MIXED
          ? providerEntries.filter(([key]) => this.catalogRecordsMap[key].productType?.includes(requestedProductType))
          : providerEntries;

      const footprintFiltered = productTypeFiltered.filter(([key]) =>
        booleanPointInPolygon([position.longitude, position.latitude], this.catalogRecordsMap[key].footprint as Feature<Polygon>)
      );

      const sorted = footprintFiltered.sort(([aKey], [bKey]) => {
        const A_BEFORE_B = -1;
        const B_BEFORE_A = 1;
        const recordA = this.catalogRecordsMap[aKey];
        const recordB = this.catalogRecordsMap[bKey];

        switch (true) {
          case (recordA.resolutionMeter as number) < (recordB.resolutionMeter as number):
            return A_BEFORE_B;
          case (recordA.resolutionMeter as number) > (recordB.resolutionMeter as number):
            return B_BEFORE_A;
          default: {
            const dateB = new Date(recordB.updateDate as string | number | Date);
            const dateA = new Date(recordA.updateDate as string | number | Date);
            return dateB.getTime() - dateA.getTime();
          }
        }
      });

      if (sorted.length === 0) {
        return { ...position } as PosWithProvider;
      }

      const [providerKey] = sorted[0];
      return { ...position, providerKey } as PosWithProvider;
    });
  }
}
```

Notes:
- The `maximumTilesPerRequest` density throw and `RequestScheduler.update()` are intentionally removed — both were quantized-mesh tile concerns. Point-count limiting stays in `validateRequestMiddleware`.
- `commonErrors` stays injected (used elsewhere in the class surface / future use); leaving the constructor param avoids DI signature churn.

- [ ] **Step 5: Run the model test to verify it passes**

Run: `npx jest --config=./tests/configurations/unit/jest.config.js heightModel`
Expected: PASS (4 tests).

- [ ] **Step 6: Commit**

```bash
git add src/heights/models/heightsManager.ts tests/configurations/testContainerConfig.ts tests/unit/heights/models/heightModel.spec.ts
git commit -m "feat: sample point heights from geotiff providers in degrees"
```

---

### Task 6: Trim utilities to checksum helpers only

**Files:**
- Modify: `src/heights/utilities.ts`

- [ ] **Step 1: Replace the file contents**

```typescript
import crypto from 'crypto';

export const generateChecksum = (str: string, algorithm?: string, encoding?: crypto.BinaryToTextEncoding): string => {
  return crypto
    .createHash(algorithm ?? 'md5')
    .update(str, 'utf8')
    .digest(encoding ?? 'hex');
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const isSame = (src1: any, src2: any): boolean => {
  return generateChecksum(JSON.stringify(src1)) === generateChecksum(JSON.stringify(src2));
};
```

- [ ] **Step 2: Confirm no remaining imports of the removed clustering function**

Run: `grep -rn "cartographicArrayClusteringForHeightRequests\|PositionsWithProviderKey" src tests`
Expected: no matches.

- [ ] **Step 3: Commit**

```bash
git add src/heights/utilities.ts
git commit -m "refactor: drop quantized-mesh tile clustering utilities"
```

---

### Task 7: CSW discovery filters GEOTIFF links

**Files:**
- Modify: `src/workerCatalogRecords.ts`

- [ ] **Step 1: Change the CSW filter**

In `src/workerCatalogRecords.ts`, replace the `mc:links` filter value:
```typescript
      {
        field: 'mc:links',
        like: 'GEOTIFF',
      },
```
and update the two comment lines above it to reference `GEOTIFF` instead of `TERRAIN_PROVIDER`/`TERRAIN_QMESH`:
```typescript
      // ******* DEM profile links carry the object protocol. We match records exposing a GEOTIFF link
      // ******* (COG served from the S3 gateway) via a LIKE filter on the LINKS field.
```

- [ ] **Step 2: Build to type-check**

Run: `npm run build`
Expected: compiles (any remaining errors are in controller/middleware/router — fixed next tasks).

- [ ] **Step 3: Commit**

```bash
git add src/workerCatalogRecords.ts
git commit -m "feat: discover GEOTIFF catalog records instead of qmesh"
```

---

### Task 8: Controller + validate types to degrees; drop radians map

**Files:**
- Modify: `src/heights/controllers/heightsController.ts`
- Modify: `src/heights/middlewares/validateRequest.ts`

- [ ] **Step 1: Update the controller request type**

In `src/heights/controllers/heightsController.ts`:

1. Replace the cesium import line:
```typescript
import { Cartographic } from 'cesium';
```
with:
```typescript
import { GeoPoint } from '../interfaces';
```

2. Change the request interface (remove `radiansToOriginalPositionsMap`, retype `positions`):
```typescript
export interface GetHeightsPointsRequest {
  positions: GeoPoint[];
  productType?: TerrainTypes;
}
```

`PosWithHeight` and `TerrainTypes` are already imported from `../interfaces`. The `getPoints` handler body is unchanged (it already passes `userInput.positions`).

- [ ] **Step 2: Update validateRequest**

In `src/heights/middlewares/validateRequest.ts`:

1. Replace the cesium import:
```typescript
import { Cartographic } from 'cesium';
```
with:
```typescript
import { GeoPoint } from '../interfaces';
```

2. Change the points type:
```typescript
    const points: GeoPoint[] = req.body.positions;
```

- [ ] **Step 3: Build to type-check these files**

Run: `npm run build`
Expected: only router + deleted-middleware errors remain (next task).

- [ ] **Step 4: Commit**

```bash
git add src/heights/controllers/heightsController.ts src/heights/middlewares/validateRequest.ts
git commit -m "refactor: type points as degrees, drop radians request map"
```

---

### Task 9: Remove radian middlewares from the route

**Files:**
- Delete: `src/heights/middlewares/dataToRadians.ts`
- Delete: `src/heights/middlewares/dataToDegrees.ts`
- Modify: `src/heights/routes/heightsRouter.ts`

- [ ] **Step 1: Delete the two middlewares**

Run:
```bash
git rm src/heights/middlewares/dataToRadians.ts src/heights/middlewares/dataToDegrees.ts
```

- [ ] **Step 2: Update the router**

In `src/heights/routes/heightsRouter.ts`:

1. Remove these two imports:
```typescript
import { positionResAsDegreesMiddleware } from '../middlewares/dataToDegrees';
import { convertReqPositionToRadiansMiddleware } from '../middlewares/dataToRadians';
```

2. Change the `router.post('/points', ...)` chain to drop both middlewares — final chain:
```typescript
  router.post(
    '/points',
    createReqCtxMiddleware(logger),
    validateRequestMiddleware(config, logger, commonErrors),
    controller.getPoints,
    addProductsDictionaryMiddleware(logger, productMetadataFields),
    sendResponseMiddleware(logger)
  );
```

- [ ] **Step 3: Full build**

Run: `npm run build`
Expected: PASS — no compile errors anywhere.

- [ ] **Step 4: Confirm cesium is fully gone from source**

Run: `grep -rn "cesium\|Cartographic\|radians" src`
Expected: no matches.

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "refactor: remove radian conversion middlewares from points route"
```

---

### Task 10: Fix the middleware unit test

**Files:**
- Modify: `tests/unit/heights/middlewares/heightsMiddlewares.spec.ts`

- [ ] **Step 1: Remove the deleted-middleware tests and imports**

In `tests/unit/heights/middlewares/heightsMiddlewares.spec.ts`:

1. Remove these imports:
```typescript
import { Cartographic } from 'cesium';
import { positionResAsDegreesMiddleware } from '../../../../src/heights/middlewares/dataToDegrees';
import { convertReqPositionToRadiansMiddleware } from '../../../../src/heights/middlewares/dataToRadians';
```

2. Remove the two now-unused declarations:
```typescript
  let dataToRadiansMiddleware: GetHeightsHandler;
  let dataToDegreesMiddleware: GetHeightsHandler;
```

3. Remove their assignments in `beforeAll`:
```typescript
    dataToRadiansMiddleware = convertReqPositionToRadiansMiddleware(logger);
    dataToDegreesMiddleware = positionResAsDegreesMiddleware(logger);
```

4. Delete the entire `describe('Data to radians middleware', ...)` and `describe('Data to degrees middleware', ...)` blocks.

The remaining blocks — `Create request id middleware`, `Add products dictionary`, `Validate request middleware` — stay unchanged. (The `PosWithHeight` import becomes unused after deleting the degrees block; remove it too if the linter flags it.)

- [ ] **Step 2: Run the middleware unit test**

Run: `npx jest --config=./tests/configurations/unit/jest.config.js heightsMiddlewares`
Expected: PASS (reqCtx, products dictionary, validate empty, validate too-many).

- [ ] **Step 3: Commit**

```bash
git add tests/unit/heights/middlewares/heightsMiddlewares.spec.ts
git commit -m "test: drop radian middleware unit tests"
```

---

### Task 11: Fix the integration test

**Files:**
- Modify: `tests/integration/heights/heights.spec.ts`

The integration suite boots the real app (the CSW worker's network fetch fails harmlessly in test, leaving providers empty), so its assertions only require `200` + response shape + the null-height invariants — all of which hold with no providers. It only needs the Cesium spy removed.

- [ ] **Step 1: Remove Cesium from the integration test**

In `tests/integration/heights/heights.spec.ts`:

1. Remove the import:
```typescript
import { Cartesian2, Cartographic, CesiumTerrainProvider } from 'cesium';
```

2. Remove the spy declaration:
```typescript
  let cesiumTerrainProviderFromUrlSpy: jest.SpyInstance;
```

3. Remove the entire `cesiumTerrainProviderFromUrlSpy = jest.spyOn(...)` + `.mockReturnValue({...})` block inside `beforeAll` (the `availability`/`tilingScheme` mock).

`basicPositionResponse` is only referenced in commented-out code; leave it or delete it — either compiles.

- [ ] **Step 2: Run the integration suite**

Run: `npm run test:integration`
Expected: PASS. All valid-params cases return `200` with correct `data` length; invalid-params return `400` with `TOO_MANY_POINTS_ERROR` / `EMPTY_POSITIONS_ARRAY`.

- [ ] **Step 3: Commit**

```bash
git add tests/integration/heights/heights.spec.ts
git commit -m "test: remove cesium terrain mock from heights integration"
```

---

### Task 12: Full verification pass

**Files:** none (verification only)

- [ ] **Step 1: Lint**

Run: `npm run lint`
Expected: no errors. If any, `npm run lint:fix` then re-run and commit with `style:`.

- [ ] **Step 2: Full test suite**

Run: `npm test`
Expected: unit + integration all green.

- [ ] **Step 3: Build**

Run: `npm run build`
Expected: clean compile, `dist/` produced.

- [ ] **Step 4: Confirm no leftover qmesh/cesium references**

Run: `grep -rn "cesium\|Cartographic\|TERRAIN_QMESH\|sampleTerrainMostDetailed\|radians" src tests`
Expected: no matches.

- [ ] **Step 5: Commit any lint fixes**

```bash
git add -A
git commit -m "style: lint fixes for geotiff migration" || echo "nothing to commit"
```

---

## Out-of-repo deployment tasks (NOT code — do after merge, coordinate with ops)

These are required for the service to actually serve heights in `dem-dev`, but they are data/infra, not part of this repo's TDD cycle:

1. **Catalog record** — the DEM CSW record(s) must expose a `GEOTIFF` link whose URL resolves (after the `cogs/` split) to the object key in bucket `dem-dev`, e.g. `https://tiles-dev.mapcolonies.net/api/dem/v1/cogs/dtm_srtm30wgs84geo_tiled256_ovr_lzw.tif`. Today the live record has a `TERRAIN_QMESH` link to `terrains/srtm100`.
2. **COG upload** — ensure the `tiled_ovr` COG (native 30 m, tiled, overviews) is the object served — NOT the coarse `_COG`. SRTM100 COG is not yet under `cogs/`; upload if 100 m coverage is required.
3. **helm-charts** — no chart change is strictly required (the service reads `s3Gateway.url` + `accessToken`, both already set to the internal gateway with token as queryParam). Confirm the gateway route/prefix `cogs/` is reachable via `dem-nginx-s3-gateway-internal`.

## Self-Review notes

- **Spec coverage:** engine swap (Tasks 3–6), discovery (Task 7), degrees end-to-end + middleware removal (Tasks 2, 8, 9), dependency swap (Task 1), tests (Tasks 5, 10, 11), verification (Task 12). API contract (`/points`, `openapi3.yaml`, response shape) is unchanged by design — no task needed.
- **Type consistency:** `GeoPoint` / `PosWithHeight` / `PosWithProvider` / `HeightProviders` defined in Task 2 are used consistently in Tasks 3–5, 8. Cache manager members `heightProviders` + `initProviders` defined in Task 4 are consumed in Task 5 and `containerConfig` (Task 4 step 2). `GeotiffHeightProvider.fromUrl(url, headers?)` signature defined in Task 3 matches its callers in Task 4 and the mock in Task 5.
- **Null-height invariant:** integration test #115-equivalent requires `productId === undefined ⇔ height === null`. Enforced in `samplePositionsHeights` (productId attached only when `height !== null`) and for the no-provider bucket.
- **nodata:** `-32768` default plus `getGDALNoData()`; any nodata neighbor → `null` (Task 3).
