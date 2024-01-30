import config from 'config';
import { parentPort } from "worker_threads";
import { PycswDemCatalogRecord } from "@map-colonies/mc-model-types";
import { CswClientWrapper } from "./common/csw/cswClientWrapper";
import { IService } from './common/csw/utils';

export type WorkerEvent = {action: 'updateValue' | 'error', value: any};
const SYNCH_RECORDS_INTERVAL = config.get<number>('synchRecordsInterval');

const  cswClient = new CswClientWrapper(
  'mc:MCDEMRecord',
  PycswDemCatalogRecord.getPyCSWMappings(),
  'http://schema.mapcolonies.com/dem',
  config.get<IService>('csw')
);


const getCatalogRecords = async (): Promise<PycswDemCatalogRecord[]> => {
  const res = await cswClient.getRecords(1, 1000, {
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
      }
      
    ],
    sort: undefined,
  });

  return res;
}

(async function updateValuePeriodically() {
  try {
    const newValue = await getCatalogRecords(); 
    parentPort?.postMessage({ action: 'updateValue', value: newValue });
  } catch(err) {
    parentPort?.postMessage({ action: 'error', value: err });
  }

  setTimeout(updateValuePeriodically, SYNCH_RECORDS_INTERVAL); 
})();
