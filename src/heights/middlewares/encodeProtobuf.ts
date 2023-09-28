import protobuf from 'protobufjs';
import { Logger } from '@map-colonies/js-logger';
import { PosWithHeight } from '../interfaces';
import { GetHeightsHandler } from '../controllers/heightsController';

export const encodeProtobufMiddleware: (protobufClass: protobuf.Type, logger: Logger) => GetHeightsHandler = (protobufClass, logger) => {
  return (req, res) => {
    const posArray = res.locals.positions as PosWithHeight[];
    
    // We should return data the same way its requested.
    if (req.headers['content-type'] === 'application/octet-stream') {
      const startTime = performance.now();

      const encodedData = protobufClass.encode({ data: posArray }).finish();

      const endTime = performance.now();

      logger.info({
        protobufEncodeTime: endTime - startTime,
        timeToResponse: performance.now() - res.locals.start,
        pointsNumber: posArray.length,
        location: '[encodeProtobufMiddleware]',
        ...res.locals.reqCtx,
      });

      if (res.locals.timerEnd) {
        res.locals.timerEnd();
      }

      res.send(encodedData);
      return;
    }

    logger.info({
      msg: 'End',
      timeToResponse: performance.now() - res.locals.start,
      pointsNumber: posArray.length,
      location: '[encodeProtobufMiddleware]',
      ...res.locals.reqCtx,
    });

    if (res.locals.timerEnd) {
      res.locals.timerEnd();
    }

    res.send({ data: posArray });
  };
};
