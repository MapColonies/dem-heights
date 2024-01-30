import { container } from 'tsyringe';
import { Logger } from '@map-colonies/js-logger';
import { PycswDemCatalogRecord } from '@map-colonies/mc-model-types';
import type { GetHeightsHandler } from '../controllers/heightsController';
import { CatalogRecords } from '../models/catalogRecords';
import { CATALOG_RECORDS_MAP } from '../../containerConfig';

export const addProductsDictionaryMiddleware: (logger: Logger, productMetadataFields: string[]) => GetHeightsHandler = (
  logger,
  productMetadataFields
) => {
  return (req, res, next) => {
    const startTime = performance.now();
    const catalogRecordsMap = container.resolve<CatalogRecords>(CATALOG_RECORDS_MAP).getValue();

    const productsDictionary = { products: {} };
    Object.values(catalogRecordsMap as unknown as Record<string, PycswDemCatalogRecord>).forEach((product) => {
      const productMetaEntry: Record<string, unknown> = {};

      const productMeta: Record<string, unknown> = {};
      (productMetadataFields as unknown as string[]).forEach((field) => {
        productMeta[field] = (product as unknown as Record<string, unknown>)[field];
      });
      productMetaEntry[product.productId as string] = productMeta;

      productsDictionary.products = {
        ...productsDictionary.products,
        ...productMetaEntry,
      };
    });
    const endTime = performance.now();

    logger.info({
      addDictionaryTime: endTime - startTime,
      productsDictionaryCount: catalogRecordsMap.length,
      location: '[addProductsDictionaryMiddleware]',
      ...res.locals.reqCtx,
    });
    res.locals.products = { ...productsDictionary.products };

    next();
  };
};
