import { Logger } from '@map-colonies/js-logger';
import { v4 } from 'uuid';
import type { GetHeightsHandler } from '../controllers/heightsController';

export const createReqIdMiddleware: (logger: Logger) => GetHeightsHandler = (logger) => {
  return (req, res, next) => {
    logger.debug({ msg: 'Generating Request ID', location: '[createReqIdMiddleware]' });

    const reqId = v4();
    res.locals.reqId = reqId;

    next();
  };
};
