import { Logger } from '@map-colonies/js-logger';
import { Math } from 'cesium';
import type { GetHeightsHandler } from '../controllers/heightsController';
import { PosWithHeight } from '../interfaces';

export const positionResAsDegreesMiddleware: (logger: Logger) => GetHeightsHandler = (logger) => {
  return (req, res, next) => {
    const startTime = performance.now();
    const posArray = res.locals.positions as PosWithHeight[];
    const posInDegrees = posArray.map(({ latitude, longitude, ...other }) => {
      return {
        latitude: Math.toDegrees(latitude),
        longitude: Math.toDegrees(longitude),
        ...other,
      };
    });

    const endTime = performance.now();

    logger.info({
      convertToDegreesTime: endTime - startTime,
      pointsNumber: posArray.length,
      location: '[positionResAsDegreesMiddleware]',
      ...res.locals.reqCtx,
    });
    res.locals.positions = posInDegrees;

    next();
  };
};
