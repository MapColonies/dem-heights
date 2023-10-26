import { Router } from 'express';
import protobuf from 'protobufjs';
import { FactoryFunction } from 'tsyringe';
import { Logger } from '@map-colonies/js-logger';
import { CommonErrors } from '../../common/commonErrors';
import { SERVICES } from '../../common/constants';
import { IConfig } from '../../common/interfaces';
import { CATALOG_RECORDS_MAP, POS_WITH_HEIGHT_PROTO_REQUEST, POS_WITH_HEIGHT_PROTO_RESPONSE, PRODUCT_METADATA_FIELDS } from '../../containerConfig';
import { HeightsController } from '../controllers/heightsController';
import { createReqCtxMiddleware } from '../middlewares/createReqCtx';
import { positionResAsDegreesMiddleware } from '../middlewares/dataToDegrees';
import { convertReqPositionToRadiansMiddleware } from '../middlewares/dataToRadians';
import { decodeProtobufMiddleware } from '../middlewares/decodeProtobuf';
import { encodeProtobufMiddleware } from '../middlewares/encodeProtobuf';
import { validateRequestMiddleware } from '../middlewares/validateRequest';
import { addProductsDictionaryMiddleware } from '../middlewares/addProductsDictionary';
import { PycswDemCatalogRecord } from '@map-colonies/mc-model-types';

const heightsRouterFactory: FactoryFunction<Router> = (dependencyContainer) => {
  const router = Router();
  const controller = dependencyContainer.resolve(HeightsController);
  const config = dependencyContainer.resolve<IConfig>(SERVICES.CONFIG);
  const commonErrors = dependencyContainer.resolve(CommonErrors);
  const posWithHeightProtoRequest = dependencyContainer.resolve<protobuf.Type>(POS_WITH_HEIGHT_PROTO_REQUEST);
  const posWithHeightProtoResponse = dependencyContainer.resolve<protobuf.Type>(POS_WITH_HEIGHT_PROTO_RESPONSE);
  const catalogRecordsMap = dependencyContainer.resolve<Record<string, PycswDemCatalogRecord>>(CATALOG_RECORDS_MAP);
  const productMetadataFields = dependencyContainer.resolve<string[]>(PRODUCT_METADATA_FIELDS);
  const logger = dependencyContainer.resolve<Logger>(SERVICES.LOGGER);

  router.post(
    '/points',
    createReqCtxMiddleware(logger),
    decodeProtobufMiddleware(posWithHeightProtoRequest, logger),
    validateRequestMiddleware(config, logger, commonErrors),
    convertReqPositionToRadiansMiddleware(logger),
    controller.getPoints,
    positionResAsDegreesMiddleware(logger),
    addProductsDictionaryMiddleware(logger, catalogRecordsMap, productMetadataFields),
    encodeProtobufMiddleware(posWithHeightProtoResponse, logger)
  );

  // router.post('/path', controller.getPath);
  // router.post('/polygon', controller.getPolygon);
  // router.post('/', controller.getHeights);
  // router.get('/:longitude/:latitude', controller.getHeight);

  return router;
};

export const HEIGHTS_ROUTER_SYMBOL = Symbol('heightsRouterFactory');

export { heightsRouterFactory };
