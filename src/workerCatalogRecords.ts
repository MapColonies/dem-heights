import { parentPort } from 'worker_threads';
import config from 'config';
import { PycswDemCatalogRecord } from '@map-colonies/mc-model-types';
import { CswClientWrapper } from './common/csw/cswClientWrapper';
import { IService } from './common/csw/utils';
import { syncRetryDelay } from './heights/utilities';

const SYNCH_RECORDS_INTERVAL = config.get<number>('synchRecordsInterval');

const cswClient = new CswClientWrapper(
  'mc:MCDEMRecord',
  PycswDemCatalogRecord.getPyCSWMappings(),
  'http://schema.mapcolonies.com/dem',
  config.get<IService>('csw')
);

const START_RECORD = 1;
const END_RECORD = 1000;

const getCatalogRecords = async (): Promise<PycswDemCatalogRecord[]> => {
  const res = await cswClient.getRecords(START_RECORD, END_RECORD, {
    filter: [
      // ******* DEM profile links carry the object protocol. We match records exposing a GEOTIFF link
      // ******* (COG served from the S3 gateway) via a LIKE filter on the LINKS field.
      // {
      //   field: 'mc:hasTerrain',
      //   eq: 'True',
      // },
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

  return res;
};

let consecutiveFailures = 0;

// eslint-disable-next-line
(async function updateValuePeriodically(): Promise<void> {
  try {
    const newValue = await getCatalogRecords();
    parentPort?.postMessage({ action: 'updateValue', value: newValue });
    consecutiveFailures = 0;
  } catch (err) {
    parentPort?.postMessage({ action: 'error', value: err });
    consecutiveFailures++;
  }

  // On startup pycsw is often not ready yet; waiting a full interval would leave heights without providers.
  const delay = consecutiveFailures === 0 ? SYNCH_RECORDS_INTERVAL : syncRetryDelay(consecutiveFailures, SYNCH_RECORDS_INTERVAL);
  // eslint-disable-next-line
  setTimeout(updateValuePeriodically, delay);
})();

export interface WorkerEvent {
  action: 'updateValue' | 'error';
  // eslint-disable-next-line
  value: any;
}
