# Catalog Sync In-Process Refactor Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the CSW catalog-sync worker thread with an in-process polling manager, and parallelize GeoTIFF provider opening, without changing the `/points` API or behavior.

**Architecture:** The catalog is fetched from CSW on a fixed timer and cached in-memory (singleton `CatalogRecords` + `DEMTerrainCacheManager.heightProviders`). Today a Node `worker_threads` Worker does the fetch and posts results back to the main thread, which diffs (`isSame`) and rebuilds providers. This is wrong for pure network I/O (threads are for CPU work), the fetched record set is structured-cloned across the thread boundary every cycle, and a dead worker silently freezes the cache (its `exit`/`error` handlers only log, no restart). This refactor moves the poll loop in-process into a new `CatalogSyncManager` (a `setTimeout` self-rescheduling loop that survives fetch errors), and replaces the sequential `for`-loop in `initProviders` with a bounded-concurrency `PromisePool`.

**Tech Stack:** TypeScript, tsyringe DI, node-config, `@map-colonies/csw-client`, `@supercharge/promise-pool` (already a dependency on this branch), Jest + ts-jest.

**Base branch:** `feat/geotiff-heights-migration` (PR #52) — NOT `master`. That PR rewrites `DEMTerrainCacheManager`, renames `initTerrainProviders`→`initProviders`, and touches `workerCatalogRecords.ts` + `containerConfig.ts`; branching off master would collide head-on and refactor soon-to-be-deleted Cesium code.

---

## Prerequisite: branch off #52

- [ ] **Step 0: Create the working branch from the #52 head**

```bash
git fetch origin feat/geotiff-heights-migration
git switch -c refactor/catalog-sync-inprocess origin/feat/geotiff-heights-migration
git log --oneline -1   # expect: tip of feat/geotiff-heights-migration
```

---

## File Structure

- **Create:** `src/heights/models/catalogSyncManager.ts` — in-process CSW poll loop; owns the `CswClientWrapper`, the fetch filter, the `isSame` diff, and `setTimeout` scheduling. Injects only `CONFIG` + `LOGGER`; receives the two cache singletons via `start(...)` to avoid a circular import with `containerConfig`.
- **Create:** `tests/unit/heights/models/catalogSyncManager.spec.ts` — unit tests for the manager (update, no-op-when-unchanged, error-survives, stop()).
- **Modify:** `src/containerConfig.ts` — delete the worker (`initCSWWorker`, `Worker`, `path`, `WorkerEvent`); register `CATALOG_SYNC_MANAGER`; start it after registration; stop it in `onSignal`.
- **Modify:** `src/heights/models/DEMTerrainCacheManager.ts` — replace the sequential `for` loop in `initProviders` with a `PromisePool` bounded by `samplingConcurrency`; keep per-record error isolation.
- **Modify:** `tests/unit/heights/models/DEMTerrainCacheManager.spec.ts` — keep the isolation test; add a "registers every record" test.
- **Modify:** `tests/integration/heights/heights.spec.ts` — override `CATALOG_SYNC_MANAGER` with a no-op stub so the real poll loop never runs during integration tests.
- **Delete:** `src/workerCatalogRecords.ts` — its `getCatalogRecords`, CSW client, `START_RECORD`/`END_RECORD`, and filter move into `CatalogSyncManager`; `WorkerEvent` is deleted with the worker.

No config keys are added — provider-open concurrency reuses the existing `samplingConcurrency` key. No build-script or Dockerfile change (removing the worker only removes the `./workerCatalogRecords.js` runtime dependency).

---

## Task 1: Parallelize `initProviders` (isolated, low-risk — do first)

**Files:**

- Modify: `src/heights/models/DEMTerrainCacheManager.ts`
- Test: `tests/unit/heights/models/DEMTerrainCacheManager.spec.ts`

- [ ] **Step 1: Add the "registers every record" failing test**

Append this test inside the existing `describe('DEMTerrainCacheManager', ...)` block in `tests/unit/heights/models/DEMTerrainCacheManager.spec.ts`:

```ts
it('registers a provider for every geotiff record', async () => {
  const records = [
    { id: 'a', links: [{ protocol: 'GEOTIFF', url: 'https://gw/cogs/a.tif' }] },
    { id: 'b', links: [{ protocol: 'GEOTIFF', url: 'https://gw/cogs/b.tif' }] },
    { id: 'c', links: [{ protocol: 'GEOTIFF', url: 'https://gw/cogs/c.tif' }] },
  ] as unknown as PycswDemCatalogRecord[];

  jest.spyOn(GeotiffHeightProvider, 'fromUrl').mockResolvedValue({} as GeotiffHeightProvider);

  const manager = new DEMTerrainCacheManager(config, jsLogger({ enabled: false }));
  await manager.initProviders(records);

  expect(Object.keys(manager.heightProviders).sort()).toEqual(['a', 'b', 'c']);
});
```

- [ ] **Step 2: Run the test to verify it PASSES against the current sequential loop**

Run: `npm run test:unit -- --testPathPattern DEMTerrainCacheManager`
Expected: PASS. (This test is a behavior-preservation guard — it must stay green through the refactor. The isolation test is the existing safety net.)

- [ ] **Step 3: Replace the sequential loop with a bounded `PromisePool`**

In `src/heights/models/DEMTerrainCacheManager.ts`, add the import near the other imports:

```ts
import PromisePool from '@supercharge/promise-pool/dist';
```

Replace the entire `initProviders` method body with:

```ts
  public async initProviders(demCatalogRecords: PycswDemCatalogRecord[]): Promise<void> {
    const heightProviders: HeightProviders = {};

    const geotiffRecords = demCatalogRecords.filter((record) => record.links?.some((link) => link.protocol === GEOTIFF_PROTOCOL));
    const samplingConcurrency = Number(this.config.get<number>('samplingConcurrency'));

    // Open providers concurrently but bounded — each fromUrl is an independent gateway round-trip.
    // A single record's failure is isolated (logged, skipped) so the rest still register.
    await PromisePool.for(geotiffRecords)
      .withConcurrency(samplingConcurrency)
      .handleError((err, record) => {
        this.logger.error({
          msg: 'Failed to open geotiff provider; skipping record',
          recordId: record.id,
          err,
          location: '[DEMTerrainCacheManager] [initProviders]',
        });
      })
      .process(async (record) => {
        const link = record.links?.find((currentLink) => currentLink.protocol === GEOTIFF_PROTOCOL);
        if (!link) {
          return;
        }
        const objectUrl = this.transformRouteToObjectUrl(link.url as string);
        const { url, headers } = this.buildAuthenticatedUrl(objectUrl);
        heightProviders[record.id as string] = await GeotiffHeightProvider.fromUrl(url, headers, samplingConcurrency);
      });

    this.heightProviders = heightProviders;
  }
```

Note: `PromisePool.handleError` that returns (does not throw) skips the failed item and lets the pool continue — this preserves the existing "skip a record whose provider fails to open" contract. `transformRouteToObjectUrl`, `buildAuthenticatedUrl`, `GEOTIFF_PROTOCOL`, and `HeightProviders` are unchanged and already present in the file.

- [ ] **Step 4: Run both DEMTerrainCacheManager tests to verify they PASS**

Run: `npm run test:unit -- --testPathPattern DEMTerrainCacheManager`
Expected: PASS — both the isolation test (skips `bad`, keeps `good`, logs error) and the "registers every record" test.

- [ ] **Step 5: Commit**

```bash
git add src/heights/models/DEMTerrainCacheManager.ts tests/unit/heights/models/DEMTerrainCacheManager.spec.ts
git commit -m "perf: open geotiff providers concurrently with bounded PromisePool"
```

---

## Task 2: Create `CatalogSyncManager` with unit tests

**Files:**

- Create: `src/heights/models/catalogSyncManager.ts`
- Test: `tests/unit/heights/models/catalogSyncManager.spec.ts`

- [ ] **Step 1: Write the failing unit test**

Create `tests/unit/heights/models/catalogSyncManager.spec.ts`:

```ts
import config from 'config';
import jsLogger from '@map-colonies/js-logger';
import { PycswDemCatalogRecord } from '@map-colonies/mc-model-types';
import { CswClientWrapper } from '../../../../src/common/csw/cswClientWrapper';
import { CatalogSyncManager } from '../../../../src/heights/models/catalogSyncManager';
import { CatalogRecords } from '../../../../src/heights/models/catalogRecords';
import DEMTerrainCacheManager from '../../../../src/heights/models/DEMTerrainCacheManager';

const RECORDS = [{ id: 'r1', links: [{ protocol: 'GEOTIFF', url: 'https://gw/cogs/r1.tif' }] }] as unknown as PycswDemCatalogRecord[];

function makeCacheManager(): DEMTerrainCacheManager {
  return { initProviders: jest.fn().mockResolvedValue(undefined) } as unknown as DEMTerrainCacheManager;
}

describe('CatalogSyncManager', () => {
  let manager: CatalogSyncManager | undefined;

  afterEach(() => {
    manager?.stop();
    manager = undefined;
    jest.restoreAllMocks();
    jest.useRealTimers();
  });

  it('fetches records, updates the cache, and rebuilds providers on first run', async () => {
    jest.spyOn(CswClientWrapper.prototype, 'getRecords').mockResolvedValue(RECORDS);
    const catalogRecords = new CatalogRecords();
    const cacheManager = makeCacheManager();

    manager = new CatalogSyncManager(config, jsLogger({ enabled: false }));
    manager.start(catalogRecords, cacheManager);
    await new Promise((resolve) => setImmediate(resolve));

    expect(Object.keys(catalogRecords.getValue())).toEqual(['r1']);
    expect(cacheManager.initProviders).toHaveBeenCalledWith(RECORDS);
  });

  it('does not rebuild providers when the fetched records are unchanged', async () => {
    jest.spyOn(CswClientWrapper.prototype, 'getRecords').mockResolvedValue(RECORDS);
    const catalogRecords = new CatalogRecords();
    catalogRecords.setValue(Object.fromEntries(RECORDS.map((r) => [r.id as string, r])));
    const cacheManager = makeCacheManager();

    manager = new CatalogSyncManager(config, jsLogger({ enabled: false }));
    manager.start(catalogRecords, cacheManager);
    await new Promise((resolve) => setImmediate(resolve));

    expect(cacheManager.initProviders).not.toHaveBeenCalled();
  });

  it('logs and survives a fetch error without throwing', async () => {
    jest.spyOn(CswClientWrapper.prototype, 'getRecords').mockRejectedValue(new Error('csw down'));
    const logger = jsLogger({ enabled: false });
    const errorSpy = jest.spyOn(logger, 'error');
    const cacheManager = makeCacheManager();

    manager = new CatalogSyncManager(config, logger);
    manager.start(new CatalogRecords(), cacheManager);
    await new Promise((resolve) => setImmediate(resolve));

    expect(errorSpy).toHaveBeenCalled();
    expect(cacheManager.initProviders).not.toHaveBeenCalled();
  });

  it('schedules the next run with the configured interval after a cycle completes', async () => {
    const setTimeoutSpy = jest.spyOn(global, 'setTimeout');
    jest.spyOn(CswClientWrapper.prototype, 'getRecords').mockResolvedValue(RECORDS);
    const interval = config.get<number>('synchRecordsInterval');

    manager = new CatalogSyncManager(config, jsLogger({ enabled: false }));
    manager.start(new CatalogRecords(), makeCacheManager());
    await new Promise((resolve) => setImmediate(resolve));

    const scheduledWithInterval = setTimeoutSpy.mock.calls.filter((call) => call[1] === interval);
    expect(scheduledWithInterval.length).toBeGreaterThanOrEqual(1);
  });

  it('stop() clears the pending timer so no further run is scheduled', async () => {
    jest.spyOn(CswClientWrapper.prototype, 'getRecords').mockResolvedValue(RECORDS);
    const clearTimeoutSpy = jest.spyOn(global, 'clearTimeout');

    manager = new CatalogSyncManager(config, jsLogger({ enabled: false }));
    manager.start(new CatalogRecords(), makeCacheManager());
    await new Promise((resolve) => setImmediate(resolve));
    manager.stop();

    expect(clearTimeoutSpy).toHaveBeenCalled();
  });
});
```

> **Jest 28 note:** this repo pins `jest@^28`, which has no `jest.advanceTimersByTimeAsync` (Jest 29+). The reschedule/stop behavior is therefore verified with real timers + `setImmediate` flushing (same mechanism as the first three tests) plus `setTimeout`/`clearTimeout` spies, rather than by advancing fake timers through async cycles. `afterEach` calls `manager?.stop()`, which clears the real pending timer so no handle leaks.

- [ ] **Step 2: Run the test to verify it FAILS**

Run: `npm run test:unit -- --testPathPattern catalogSyncManager`
Expected: FAIL — `Cannot find module '.../catalogSyncManager'` (file not yet created).

- [ ] **Step 3: Create the `CatalogSyncManager` implementation**

Create `src/heights/models/catalogSyncManager.ts`:

```ts
import { inject, injectable } from 'tsyringe';
import { Logger } from '@map-colonies/js-logger';
import { PycswDemCatalogRecord } from '@map-colonies/mc-model-types';
import { IConfig } from '../../common/interfaces';
import { SERVICES } from '../../common/constants';
import { CswClientWrapper } from '../../common/csw/cswClientWrapper';
import { IService } from '../../common/csw/utils';
import { isSame } from '../utilities';
import { CatalogRecords } from './catalogRecords';
import DEMTerrainCacheManager from './DEMTerrainCacheManager';

const START_RECORD = 1;
const END_RECORD = 1000;

@injectable()
export class CatalogSyncManager {
  private readonly cswClient: CswClientWrapper;
  private readonly intervalMs: number;
  private timer: NodeJS.Timeout | undefined;
  private stopped = false;
  private catalogRecords: CatalogRecords | undefined;
  private cacheManager: DEMTerrainCacheManager | undefined;

  public constructor(@inject(SERVICES.CONFIG) private readonly config: IConfig, @inject(SERVICES.LOGGER) private readonly logger: Logger) {
    this.cswClient = new CswClientWrapper(
      'mc:MCDEMRecord',
      PycswDemCatalogRecord.getPyCSWMappings(),
      'http://schema.mapcolonies.com/dem',
      this.config.get<IService>('csw')
    );
    this.intervalMs = this.config.get<number>('synchRecordsInterval');
  }

  public start(catalogRecords: CatalogRecords, cacheManager: DEMTerrainCacheManager): void {
    this.catalogRecords = catalogRecords;
    this.cacheManager = cacheManager;
    this.stopped = false;
    void this.syncOnce();
  }

  public stop(): void {
    this.stopped = true;
    if (this.timer) {
      clearTimeout(this.timer);
      this.timer = undefined;
    }
  }

  private async syncOnce(): Promise<void> {
    const catalogRecords = this.catalogRecords;
    const cacheManager = this.cacheManager;

    try {
      const records = await this.fetchCatalogRecords();
      if (catalogRecords && cacheManager && !isSame(records, Object.values(catalogRecords.getValue()))) {
        catalogRecords.setValue(Object.fromEntries(records.map((record) => [record.id as string, record])));
        await cacheManager.initProviders(records);
        this.logger.info({ msg: `CatalogRecords UPDATED - ${records.length} records fetched`, location: '[CatalogSyncManager]' });
      }
    } catch (err) {
      this.logger.error({ msg: 'FETCH CatalogRecords ERROR', err, location: '[CatalogSyncManager]' });
    } finally {
      if (!this.stopped) {
        this.timer = setTimeout(() => void this.syncOnce(), this.intervalMs);
      }
    }
  }

  private async fetchCatalogRecords(): Promise<PycswDemCatalogRecord[]> {
    return this.cswClient.getRecords(START_RECORD, END_RECORD, {
      filter: [
        // DEM profile links carry the object protocol. We match records exposing a GEOTIFF link
        // (COG served from the S3 gateway) via a LIKE filter on the LINKS field.
        {
          field: 'mc:links',
          like: 'GEOTIFF',
        },
        {
          field: 'mc:productStatus',
          eq: 'PUBLISHED',
        },
      ],
      sort: undefined,
    });
  }
}
```

- [ ] **Step 4: Run the test to verify it PASSES**

Run: `npm run test:unit -- --testPathPattern catalogSyncManager`
Expected: PASS — all five cases (update, no-op-unchanged, error-survives, schedules-next-run, stop-clears-timer).

- [ ] **Step 5: Commit**

```bash
git add src/heights/models/catalogSyncManager.ts tests/unit/heights/models/catalogSyncManager.spec.ts
git commit -m "feat: add in-process CatalogSyncManager poll loop"
```

---

## Task 3: Wire `CatalogSyncManager` into bootstrap; remove the worker

**Files:**

- Modify: `src/containerConfig.ts`
- Modify: `tests/integration/heights/heights.spec.ts`
- Delete: `src/workerCatalogRecords.ts`

- [ ] **Step 1: Stub the sync manager in the integration override (write first — this is the guard)**

In `tests/integration/heights/heights.spec.ts`, add the import alongside the existing container imports:

```ts
import { CATALOG_RECORDS_MAP, CATALOG_SYNC_MANAGER, DEM_TERRAIN_CACHE_MANAGER } from '../../../src/containerConfig';
```

(That replaces the existing `import { CATALOG_RECORDS_MAP, DEM_TERRAIN_CACHE_MANAGER } from '../../../src/containerConfig';` line — add `CATALOG_SYNC_MANAGER` to it.)

Then extend the `getApp` override in `beforeAll` so the real poll loop never runs in tests:

```ts
const app = await getApp({
  override: [
    { token: SERVICES.LOGGER, provider: { useValue: jsLogger({ enabled: false }) } },
    { token: CATALOG_SYNC_MANAGER, provider: { useValue: { start: (): void => undefined, stop: (): void => undefined } } },
  ],
});
```

- [ ] **Step 2: Rewrite `src/containerConfig.ts` to remove the worker and start the manager**

Replace the entire contents of `src/containerConfig.ts` with:

```ts
import config from 'config';
import pino from 'pino';
import client from 'prom-client';
import { instanceCachingFactory, container, Lifecycle } from 'tsyringe';
import { DependencyContainer } from 'tsyringe/dist/typings/types';
import { trace } from '@opentelemetry/api';
import jsLogger, { LoggerOptions } from '@map-colonies/js-logger';
import { getOtelMixin } from '@map-colonies/telemetry';
import { SERVICES, SERVICE_NAME } from './common/constants';
import { InjectionObject, registerDependencies } from './common/dependencyRegistration';
import { IConfig } from './common/interfaces';
import { tracing } from './common/tracing';
import DEMTerrainCacheManager from './heights/models/DEMTerrainCacheManager';
import { heightsRouterFactory, HEIGHTS_ROUTER_SYMBOL } from './heights/routes/heightsRouter';
import { CatalogRecords } from './heights/models/catalogRecords';
import { CatalogSyncManager } from './heights/models/catalogSyncManager';

export interface RegisterOptions {
  override?: InjectionObject<unknown>[];
  useChild?: boolean;
}

export const CATALOG_RECORDS_MAP = Symbol('CATALOG_RECORDS_MAP');
export const PRODUCT_METADATA_FIELDS = Symbol('PRODUCT_METADATA_FIELDS');
export const DEM_TERRAIN_CACHE_MANAGER = Symbol('DEM_TERRAIN_CACHE_MANAGER');
export const CATALOG_SYNC_MANAGER = Symbol('CATALOG_SYNC_MANAGER');

export const registerExternalValues = async (options?: RegisterOptions): Promise<DependencyContainer> => {
  const loggerConfig = config.get<LoggerOptions>('telemetry.logger');
  // @ts-expect-error the signature is wrong
  const logger = jsLogger({ ...loggerConfig, mixin: getOtelMixin(), timestamp: pino.stdTimeFunctions.isoTime });

  const productMetadataFields = config.get<string>('productMetadataFields').split(',');

  tracing.start();
  const tracer = trace.getTracer(SERVICE_NAME);

  const dependencies: InjectionObject<unknown>[] = [
    { token: SERVICES.CONFIG, provider: { useValue: config } },
    { token: SERVICES.LOGGER, provider: { useValue: logger } },
    { token: SERVICES.TRACER, provider: { useValue: tracer } },
    {
      token: SERVICES.METRICS_REGISTRY,
      provider: {
        useFactory: instanceCachingFactory((container) => {
          const config = container.resolve<IConfig>(SERVICES.CONFIG);
          if (config.get<boolean>('telemetry.metrics.enabled')) {
            client.register.setDefaultLabels({
              app: SERVICE_NAME,
            });
            return client.register;
          }
        }),
      },
    },
    { token: CATALOG_RECORDS_MAP, provider: { useClass: CatalogRecords }, options: { lifecycle: Lifecycle.Singleton } },
    { token: PRODUCT_METADATA_FIELDS, provider: { useValue: productMetadataFields } },
    { token: DEM_TERRAIN_CACHE_MANAGER, provider: { useClass: DEMTerrainCacheManager }, options: { lifecycle: Lifecycle.Singleton } },
    { token: CATALOG_SYNC_MANAGER, provider: { useClass: CatalogSyncManager }, options: { lifecycle: Lifecycle.Singleton } },
    { token: HEIGHTS_ROUTER_SYMBOL, provider: { useFactory: heightsRouterFactory } },
    {
      token: 'onSignal',
      provider: {
        useValue: {
          useValue: async (): Promise<void> => {
            container.resolve<CatalogSyncManager>(CATALOG_SYNC_MANAGER).stop();
            await Promise.all([tracing.stop()]);
          },
        },
      },
    },
  ];

  const registeredContainer = registerDependencies(dependencies, options?.override, options?.useChild);

  registeredContainer
    .resolve<CatalogSyncManager>(CATALOG_SYNC_MANAGER)
    .start(
      registeredContainer.resolve<CatalogRecords>(CATALOG_RECORDS_MAP),
      registeredContainer.resolve<DEMTerrainCacheManager>(DEM_TERRAIN_CACHE_MANAGER)
    );

  return registeredContainer;
};
```

What changed vs. the #52 version: removed `import { Worker } from 'worker_threads'`, `import path`, the `PycswDemCatalogRecord` import, `import { isSame }`, and `import { WorkerEvent }`; deleted the entire `initCSWWorker` function and its call; added the `CatalogSyncManager` import, the `CATALOG_SYNC_MANAGER` symbol, its DI registration, the `.start(...)` call after registration, and the `.stop()` call in `onSignal`. The `container` import is retained (used by `onSignal` and the metrics factory).

- [ ] **Step 3: Delete the worker source file**

```bash
git rm src/workerCatalogRecords.ts
```

- [ ] **Step 4: Verify nothing else references the worker**

Run: `git grep -n "workerCatalogRecords\|WorkerEvent\|initCSWWorker\|worker_threads" -- src tests`
Expected: no output (empty). If anything prints, fix that reference before proceeding.

- [ ] **Step 5: Build to confirm no dangling imports / type errors**

Run: `npm run build`
Expected: clean exit, no TypeScript errors.

- [ ] **Step 6: Commit**

```bash
git add src/containerConfig.ts tests/integration/heights/heights.spec.ts
git commit -m "refactor: replace CSW worker thread with in-process CatalogSyncManager"
```

---

## Task 4: Full verification

**Files:** none (verification only)

- [ ] **Step 1: Run the full unit suite with coverage**

Run: `npm run test:unit`
Expected: all suites PASS, coverage gate met (branches ≥60, functions ≥80, lines ≥80). New `catalogSyncManager.ts` is under `src/heights/models/` (in the unit coverage set) and is covered by Task 2's tests; `containerConfig.ts` is excluded from unit coverage by the `!<rootDir>/src/*` glob.

- [ ] **Step 2: Run the full integration suite**

Run: `npm run test:integration`
Expected: 8/8 PASS, coverage gate met, and — unlike before — no `CatalogRecords ERROR` / worker-exit noise in the log (the sync manager is stubbed via the override; no real CSW fetch, no leaked timers, Jest exits cleanly).

- [ ] **Step 3: Lint**

Run: `npm run lint`
Expected: clean.

- [ ] **Step 4: Confirm the worker is fully gone from the build output**

Run: `ls dist/workerCatalogRecords.js 2>/dev/null && echo "STILL PRESENT — investigate" || echo "removed OK"`
Expected: `removed OK` (a stale `dist` from a previous build is fine to ignore; a fresh `npm run build` in Task 3 Step 5 will not emit it).

- [ ] **Step 5: Push and open the PR against the #52 branch**

```bash
git push -u origin refactor/catalog-sync-inprocess
gh pr create --base feat/geotiff-heights-migration --repo MapColonies/dem-heights \
  --title "refactor: in-process catalog sync + concurrent provider opens (MAPCO-11560)" \
  --body "Replaces the CSW worker thread with an in-process CatalogSyncManager poll loop and parallelizes GeoTIFF provider opening. Stacked on #52."
```

Note: base is `feat/geotiff-heights-migration`, so this PR merges into #52, not master. If #52 merges to master first, rebase this branch onto master before merging.

---

## Self-Review

**Spec coverage:**

- Replace worker with in-process poll → Tasks 2 (manager) + 3 (wiring/removal). ✅
- Fix silent-death → inherent: the `setTimeout` self-reschedule in `syncOnce`'s `finally` survives fetch errors; there is no separate process to die (Task 2, error test proves survival). ✅
- Parallelize provider opens → Task 1. ✅
- No API/behavior change → `/points`, response shape, `openapi3.yaml` untouched; startup remains non-blocking (loop kicked off, not awaited), matching prior behavior. ✅
- No test regressions / no leaked timers → Task 3 Step 1 stub + Task 4. ✅

**Placeholder scan:** No TBD/TODO/"handle errors appropriately"; every code step contains full code. ✅

**Type consistency:** `initProviders` (not `initTerrainProviders`); `heightProviders` property; `HeightProviders` type; `start(catalogRecords, cacheManager)` signature matches both the `containerConfig` caller and the unit-test caller; `CATALOG_SYNC_MANAGER` symbol name identical across `containerConfig`, `onSignal`, and the integration override. ✅

**Decisions locked:**

- Manager injects only CONFIG + LOGGER and receives singletons via `start(...)` — deliberately avoids importing the DI symbols from `containerConfig` (which imports the manager), preventing a circular-import decoration hazard.
- Provider-open concurrency reuses `samplingConcurrency` rather than adding a new config key (records are few; avoids config sprawl across `default.json` / `custom-environment-variables.json` / helm).
