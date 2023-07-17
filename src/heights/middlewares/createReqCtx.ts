import { Logger } from '@map-colonies/js-logger';
import { v4 } from 'uuid';
import { get } from 'lodash';
import type { GetHeightsHandler } from '../controllers/heightsController';

export const createReqCtxMiddleware: (logger: Logger) => GetHeightsHandler = (logger) => {
  return (req, res, next) => {
    logger.debug({ msg: 'Generating Request ID', location: '[createReqCtxMiddleware]' });

    const reqId = v4();
    res.locals.reqCtx = {
      reqId,
      customerName: get(req, `headers['x-sub']`)
    }
    next();
  };
};
