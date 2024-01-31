import { parentPort } from 'worker_threads';
import config from 'config';
import { PycswDemCatalogRecord } from '@map-colonies/mc-model-types';
import { CswClientWrapper } from './common/csw/cswClientWrapper';
import { IService } from './common/csw/utils';

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
      // ******* DEM profile has special BOOLEAN field 'mc:hasTerrain' which holds an indication of TERRAIN_PROVIDER
      // ******* Probably there is a bug when filtering by BOOLEAN field. Instead used LIKE filter that looks in LINKS field
      // {
      //   field: 'mc:hasTerrain',
      //   eq: 'True',
      // },
      {
        field: 'mc:links',
        like: 'TERRAIN_QMESH',
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

await (async function updateValuePeriodically(): Promise<void> {
  try {
    const newValue = await getCatalogRecords();
    parentPort?.postMessage({ action: 'updateValue', value: newValue });
  } catch (err) {
    parentPort?.postMessage({ action: 'error', value: err });
  }

  // eslint-disable-next-line
  setTimeout(updateValuePeriodically, SYNCH_RECORDS_INTERVAL);
})();

export interface WorkerEvent {
  action: 'updateValue' | 'error';
  // eslint-disable-next-line
  value: any;
}
