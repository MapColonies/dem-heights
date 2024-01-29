import { PycswDemCatalogRecord } from '@map-colonies/mc-model-types';
import { injectable } from 'tsyringe';

@injectable()
export class CatalogRecords {
  private value: Record<string, PycswDemCatalogRecord> = {};

  getValue(): Record<string, PycswDemCatalogRecord> {
    return this.value;
  }

  setValue(newValue: Record<string, PycswDemCatalogRecord>): void {
    this.value = newValue;
  }
}
