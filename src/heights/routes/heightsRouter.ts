import { Router } from 'express';
import { FactoryFunction } from 'tsyringe';
import protobuf from 'protobufjs';
import { Logger } from '@map-colonies/js-logger';
import { HeightsController } from '../controllers/heightsController';
import { convertReqPositionToRadiansMiddleware } from '../middlewares/dataToRadians';
import { positionResAsDegreesMiddleware } from '../middlewares/dataToDegrees';
import { POS_WITH_HEIGHT_PROTO_REQUEST, POS_WITH_HEIGHT_PROTO_RESPONSE } from '../../containerConfig';
import { encodeProtobufMiddleware } from '../middlewares/encodeProtobuf';
import { decodeProtobufMiddleware } from '../middlewares/decodeProtobuf';
import { SERVICES } from '../../common/constants';
import { createReqIdMiddleware } from '../middlewares/createReqId';

const heightsRouterFactory: FactoryFunction<Router> = (dependencyContainer) => {
  const router = Router();
  const controller = dependencyContainer.resolve(HeightsController);
  const posWithHeightProtoRequest = dependencyContainer.resolve<protobuf.Type>(POS_WITH_HEIGHT_PROTO_REQUEST);
  const posWithHeightProtoResponse = dependencyContainer.resolve<protobuf.Type>(POS_WITH_HEIGHT_PROTO_RESPONSE);

  const logger = dependencyContainer.resolve<Logger>(SERVICES.LOGGER);

  router.post(
    '/points',
    createReqIdMiddleware(logger),
    decodeProtobufMiddleware(posWithHeightProtoRequest, logger),
    convertReqPositionToRadiansMiddleware(logger),
    controller.getPoints,
    positionResAsDegreesMiddleware(logger),
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
