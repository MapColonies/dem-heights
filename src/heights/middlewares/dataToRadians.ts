import { Cartographic } from 'cesium';
import { Logger } from '@map-colonies/js-logger';
import type { GetHeightsHandler } from '../controllers/heightsController';

export const convertReqPositionToRadiansMiddleware: (logger: Logger) => GetHeightsHandler = (logger) => {
  return (req, res, next) => {
    const startTime = performance.now();
    const posArray = req.body.positions;
    const radiansToOriginalPositionsMap = new Map<string, string>();

    const positions = req.body.positions.map((pos) => {
      const radiansPosition = Cartographic.fromDegrees(pos.longitude, pos.latitude);

      // Populating the dictionary between the original requested positions and the radians we work with internally.
      // Key is "longitude;latitude"
      radiansToOriginalPositionsMap.set(`${radiansPosition.longitude};${radiansPosition.latitude}`, `${pos.longitude};${pos.latitude}`);

      return radiansPosition;
    });

    const endTime = performance.now();

    logger.info({
      convertToRadiansTime: endTime - startTime,
      pointsNumber: posArray.length,
      location: '[convertReqPositionToRadiansMiddleware]',
      ...res.locals.reqCtx,
    });

    req.body = { ...req.body, radiansToOriginalPositionsMap, positions };

    next();
  };
};
