import { Logger } from '@map-colonies/js-logger';
import { GetHeightsHandler } from '../controllers/heightsController';
import { PosWithHeight } from '../interfaces';

export const sendResponseMiddleware: (logger: Logger) => GetHeightsHandler = (logger) => {
  return (req, res) => {
    const posArray = res.locals.positions as PosWithHeight[];

    logger.info({
      msg: 'End',
      timeToResponse: performance.now() - res.locals.start,
      pointsNumber: posArray.length,
      location: '[sendResponseMiddleware]',
      ...res.locals.reqCtx,
    });

    res.send({
      data: posArray,
      products: res.locals.products as Record<string, unknown>,
    });
  };
};
