import protobuf from 'protobufjs';
import { Logger } from '@map-colonies/js-logger';
import { PosWithHeight } from '../interfaces';
import { GetHeightsHandler } from '../controllers/heightsController';

export const encodeProtobufMiddleware: (protobufClass: protobuf.Type, logger: Logger) => GetHeightsHandler = (protobufClass, logger) => {
  return (req, res) => {
    const startTime = performance.now();
    const posArray = res.locals.positions as PosWithHeight[];

    // We should return data the same way its requested.
    if (req.headers['content-type'] === 'application/octet-stream') {
      const encodedData = protobufClass.encode({ data: posArray }).finish();

      const endTime = performance.now();

      logger.debug({
        protobufEncodeTime: endTime - startTime,
        pointsNumber: posArray.length,
        location: '[encodeProtobufMiddleware]',
        reqId: res.locals.reqId as string,
      });

      res.send(encodedData);
      return;
    }

    res.send({ data: posArray });
  };
};
