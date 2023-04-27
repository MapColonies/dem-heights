import { Router } from "express";
import { FactoryFunction } from "tsyringe";
import protobuf from 'protobufjs';
import { HeightsController } from "../controllers/heightsController";
import { convertReqPositionToRadiansMiddleware } from "../middlewares/dataToRadians";
import { positionResAsDegreesMiddleware } from "../middlewares/dataToDegrees";
import { POS_WITH_HEIGHT_PROTO } from "../../containerConfig";
import { encodeProtobufMiddleware } from "../middlewares/encodeProtobuf";
import { decodeProtobufMiddleware } from "../middlewares/decodeProtobuf";

const heightsRouterFactory: FactoryFunction<Router> = (dependencyContainer) => {
    const router = Router();
    const controller = dependencyContainer.resolve(HeightsController);
    const posWithHeightProto = dependencyContainer.resolve<protobuf.Type>(POS_WITH_HEIGHT_PROTO);

    router.post(
        "/points",
        // decodeProtobufMiddleware(posWithHeightProto),
        convertReqPositionToRadiansMiddleware,
        controller.getPoints,
        positionResAsDegreesMiddleware,
        encodeProtobufMiddleware(posWithHeightProto)

    );
    // router.post('/path', controller.getPath);
    // router.post('/polygon', controller.getPolygon);
    // router.post('/', controller.getHeights);
    // router.get('/:longitude/:latitude', controller.getHeight);

    return router;
};

export const HEIGHTS_ROUTER_SYMBOL = Symbol("heightsRouterFactory");

export { heightsRouterFactory };
