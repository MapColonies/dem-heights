import { PycswDemCatalogRecord } from '@map-colonies/mc-model-types';
import { injectable } from 'tsyringe';

@injectable()
export class CatalogRecords {
  private value: Record<string, PycswDemCatalogRecord> = {};

  public getValue(): Record<string, PycswDemCatalogRecord> {
    return this.value;
  }

  public setValue(newValue: Record<string, PycswDemCatalogRecord>): void {
    this.value = newValue;
  }
}
