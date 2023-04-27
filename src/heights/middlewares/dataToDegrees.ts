import { Math } from "cesium";
import type { GetHeightsHandler } from "../controllers/heightsController";
import { PosWithHeight } from "../interfaces";

export const positionResAsDegreesMiddleware: GetHeightsHandler = (req, res, next) => {
    const posInDegrees = (res.locals.positions as PosWithHeight[]).map(({latitude, longitude, ...other}) => {
        return {
            latitude: Math.toDegrees(latitude),
            longitude: Math.toDegrees(longitude),
            ...other
        };
    });

    res.locals.positions = posInDegrees;
    
    next()
};
