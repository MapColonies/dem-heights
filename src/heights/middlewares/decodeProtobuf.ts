import protobuf from 'protobufjs';
import { Logger } from '@map-colonies/js-logger';
import { GetHeightsHandler, GetHeightsPointsRequest } from '../controllers/heightsController';

export const decodeProtobufMiddleware: (protobufClass: protobuf.Type, logger: Logger) => GetHeightsHandler = (protobufClass, logger) => {
  return (req, res, next) => {
    // Check if payload is a binary data
    if (req.headers['content-type'] === 'application/octet-stream') {
      const startTime = performance.now();

      // Body parser will transform req.body to a buffer if content type header represents binary data
      const reqUintArray = new Uint8Array(req.body as unknown as ArrayBufferLike);
      const decodedData = protobufClass.decode(reqUintArray);
      req.body = decodedData.toJSON() as GetHeightsPointsRequest;
      const posArray = req.body.positions;

      const endTime = performance.now();

      logger.info({
        protobufDecodeTime: endTime - startTime,
        pointsNumber: posArray.length,
        location: '[decodeProtobufMiddleware]',
        ...res.locals.reqCtx,
      });
    }

    next();
  };
};
