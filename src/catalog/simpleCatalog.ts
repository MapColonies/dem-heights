import { BBox } from 'geojson';
import { injectable } from 'tsyringe';
import { ICatalog } from './catalog';
import { CswClient, CswRecord } from './csw';

const getLatestRecord = (records: CswRecord[]): CswRecord => {
  const res = records[0].resolution;
  let recordToReturnIndex = 0;
  for (let i = 1; i < records.length; i++) {
    if (records[i].resolution !== res) {
      break;
    }
    if (records[i].imagingEndDate.localeCompare(records[recordToReturnIndex].imagingEndDate) > 0) {
      recordToReturnIndex = i;
    }
  }
  return records[recordToReturnIndex];
};

@injectable()
export class SimpleCatalog implements ICatalog {
  public constructor(private readonly cswClient: CswClient) {}

  public async getCoverageId(bbox: BBox): Promise<string> {
    const res = await this.cswClient.getRecords(bbox, 'ASC', 'mc:resolutionMeter', 1);
    if (res.records.length === 0) {
      throw new Error('No matching record was found');
    }
    return getLatestRecord(res.records).coverageId;
  }
}