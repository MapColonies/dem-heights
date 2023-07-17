import { Logger } from '@map-colonies/js-logger';
import { Cartographic } from 'cesium';
import type { GetHeightsHandler } from '../controllers/heightsController';

export const convertReqPositionToRadiansMiddleware: (logger: Logger) => GetHeightsHandler = (logger) => {
  return (req, res, next) => {
    const startTime = performance.now();
    const posArray = req.body.positions;

    const positions = req.body.positions.map((pos) => {
      return Cartographic.fromDegrees(pos.longitude, pos.latitude);
    });

    const endTime = performance.now();

    logger.debug({
      convertToRadiansTime: endTime - startTime,
      pointsNumber: posArray.length,
      location: '[convertReqPositionToRadiansMiddleware]',
      ...res.locals.reqCtx,
    });

    req.body = { ...req.body, positions };

    next();
  };
};
