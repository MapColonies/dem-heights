import { get } from 'lodash';
import { v4 } from 'uuid';
import { Logger } from '@map-colonies/js-logger';
import type { GetHeightsHandler } from '../controllers/heightsController';

export const createReqCtxMiddleware: (logger: Logger) => GetHeightsHandler = (logger) => {
  return (req, res, next) => {
    res.locals.start = performance.now();

    const reqId = v4();

    res.locals.reqCtx = {
      reqId,
      customerName: get(req, `headers['x-client-id']`),
    };

    logger.info({
      msg: 'Start',
      location: '[createReqCtxMiddleware]',
      ...res.locals.reqCtx,
    });

    next();
  };
};
