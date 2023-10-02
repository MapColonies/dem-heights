import { Logger } from '@map-colonies/js-logger';
import type { GetHeightsHandler } from '../controllers/heightsController';
import { PosWithHeight } from '../interfaces';

export const positionResAsDegreesMiddleware: (logger: Logger) => GetHeightsHandler = (logger) => {
  return (req, res, next) => {
    const startTime = performance.now();
    const posArray = res.locals.positions as PosWithHeight[];
    const radiansToOriginalPositionsMap = req.body.radiansToOriginalPositionsMap;

    const posInDegrees = posArray.map(({ latitude, longitude, ...other }) => {
      // Using the original position requested.
      const originalPositionKey = `${longitude};${latitude}`;
      const [originalLongitude, originalLatitude] = radiansToOriginalPositionsMap.get(originalPositionKey)?.split(';') ?? [];

      return {
        latitude: Number(originalLatitude),
        longitude: Number(originalLongitude),
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
