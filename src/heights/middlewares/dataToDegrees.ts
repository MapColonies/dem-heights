import { Logger } from "@map-colonies/js-logger";
import { Math } from "cesium";
import type { GetHeightsHandler } from "../controllers/heightsController";
import { PosWithHeight } from "../interfaces";

export const positionResAsDegreesMiddleware: (logger: Logger) => GetHeightsHandler = (logger) => {
    return (req, res, next) => {
        const startTime = performance.now();

        const posInDegrees = (res.locals.positions as PosWithHeight[]).map(
            ({ latitude, longitude, ...other }) => {
                return {
                    latitude: Math.toDegrees(latitude),
                    longitude: Math.toDegrees(longitude),
                    ...other
                };
            }
        );

        const endTime = performance.now();

        logger.debug({ msg: `Converting response to degrees took ${endTime - startTime} ms`, location: '[positionResAsDegreesMiddleware]', reqId: res.locals.reqId as string })
        res.locals.positions = posInDegrees;

        next();
    };
};
