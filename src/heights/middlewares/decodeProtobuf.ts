import client from 'prom-client';
import protobuf from 'protobufjs';
import { Logger } from '@map-colonies/js-logger';
import { GetHeightsHandler, GetHeightsPointsRequest } from '../controllers/heightsController';
import { PosWithHeight } from '../interfaces';

export const decodeProtobufMiddleware: (protobufClass: protobuf.Type, logger: Logger, registry: client.Registry) => GetHeightsHandler = (protobufClass, logger, registry) => {
  return (req, res, next) => {
    let posArray: PosWithHeight[];

    // Check if payload is a binary data
    if (req.headers['content-type'] === 'application/octet-stream') {
      const startTime = performance.now();

      // Body parser will transform req.body to a buffer if content type header represents binary data
      const reqUintArray = new Uint8Array(req.body as unknown as ArrayBufferLike);
      const decodedData = protobufClass.decode(reqUintArray);
      req.body = decodedData.toJSON() as GetHeightsPointsRequest;
      posArray = req.body.positions;

      const endTime = performance.now();

      logger.info({
        protobufDecodeTime: endTime - startTime,
        pointsNumber: posArray.length,
        location: '[decodeProtobufMiddleware]',
        ...res.locals.reqCtx,
      });
    }

    if (registry !== undefined) {
      posArray = req.body.positions;

      const elevationsRequestHistogram: client.Histogram<'pointsNumber'> = new client.Histogram({
        name: 'elevations_request_duration_seconds',
        help: 'Request duration time (seconds)',
        // buckets: config.get<number[]>('telemetry.metrics.buckets'),
        labelNames: ['pointsNumber'] as const,
        registers: [registry],
      });

      const timerEnd = elevationsRequestHistogram?.startTimer({ pointsNumber: posArray.length });

      res.locals.timerEnd = timerEnd;
    }

    next();
  };
};
