import { Logger } from "@map-colonies/js-logger";
import { Cartographic } from "cesium";
import type { GetHeightsHandler } from "../controllers/heightsController";

export const convertReqPositionToRadiansMiddleware: (logger: Logger) => GetHeightsHandler = (
    logger
) => {
    return (req, res, next) => {
        const startTime = performance.now();
        
        const positions = req.body.positions.map((pos) => {
            return Cartographic.fromDegrees(pos.longitude, pos.latitude);
        });
        
        const endTime = performance.now();

        logger.debug({msg: `Convert request positions to radians took ${endTime - startTime} ms`, location: '[convertReqPositionToRadiansMiddleware]', reqId: res.locals.reqId as string })
        
        req.body = { ...req.body, positions };

        next();
    };
};
