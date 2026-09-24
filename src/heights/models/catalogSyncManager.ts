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

// isSame checksums a JSON serialization, so array order matters. CSW may return the same
// records in a different order between polls — normalize by id so reordering alone doesn't
// trigger a needless provider rebuild.
const sortById = (records: PycswDemCatalogRecord[]): PycswDemCatalogRecord[] =>
  [...records].sort((first, second) => (first.id as string).localeCompare(second.id as string));

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
      if (catalogRecords && cacheManager && !isSame(sortById(records), sortById(Object.values(catalogRecords.getValue())))) {
        // Rebuild providers before publishing the new catalog. Otherwise, during initProviders'
        // await window a reader sees the new catalog paired with stale providers, and a removed
        // record resolves to an undefined catalog entry (throws on .footprint access).
        await cacheManager.initProviders(records);
        catalogRecords.setValue(Object.fromEntries(records.map((record) => [record.id as string, record])));
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
