import { Router } from "express";
import { FactoryFunction } from "tsyringe";
import protobuf from 'protobufjs';
import { HeightsController } from "../controllers/heightsController";
import { convertReqPositionToRadiansMiddleware } from "../middlewares/dataToRadians";
import { positionResAsDegreesMiddleware } from "../middlewares/dataToDegrees";
import { POS_WITH_HEIGHT_PROTO_REQUEST, POS_WITH_HEIGHT_PROTO_RESPONSE } from "../../containerConfig";
import { encodeProtobufMiddleware } from "../middlewares/encodeProtobuf";
import { decodeProtobufMiddleware } from "../middlewares/decodeProtobuf";

const heightsRouterFactory: FactoryFunction<Router> = (dependencyContainer) => {
    const router = Router();
    const controller = dependencyContainer.resolve(HeightsController);
    const posWithHeightProtoRequest = dependencyContainer.resolve<protobuf.Type>(POS_WITH_HEIGHT_PROTO_REQUEST);
    const posWithHeightProtoResponse = dependencyContainer.resolve<protobuf.Type>(POS_WITH_HEIGHT_PROTO_RESPONSE);
    
    router.post(
        "/points",
        decodeProtobufMiddleware(posWithHeightProtoRequest),
        convertReqPositionToRadiansMiddleware,
        controller.getPoints,
        positionResAsDegreesMiddleware,
        encodeProtobufMiddleware(posWithHeightProtoResponse)
    );
    
    // router.post('/path', controller.getPath);
    // router.post('/polygon', controller.getPolygon);
    // router.post('/', controller.getHeights);
    // router.get('/:longitude/:latitude', controller.getHeight);

    return router;
};

export const HEIGHTS_ROUTER_SYMBOL = Symbol("heightsRouterFactory");

export { heightsRouterFactory };
