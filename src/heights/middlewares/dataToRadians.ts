import { Cartographic } from "cesium";
import type { GetHeightsHandler } from "../controllers/heightsController";


export const convertReqPositionToRadiansMiddleware: GetHeightsHandler = (req, res, next) => {
    const positions = req.body.positions.map(pos => {
        return Cartographic.fromDegrees(pos.longitude, pos.latitude);
    });

    req.body = { ...req.body, positions };

    next();
};