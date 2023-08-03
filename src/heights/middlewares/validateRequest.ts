import { Logger } from '@map-colonies/js-logger';
import { CommonErrors } from '../../common/commonErrors';
import { IConfig } from '../../common/interfaces';
import { GetHeightsHandler } from '../controllers/heightsController';
import { PosWithHeight } from '../interfaces';

export const validateRequestMiddleware: (config: IConfig, logger: Logger, commonErrors: CommonErrors) => GetHeightsHandler = (
  config,
  logger,
  commonErrors
) => {
  return (req, res, next) => {
    const MAXIMUM_TILES_PER_REQUEST = config.has('maximumTilesPerRequest') ? config.get<number>('maximumTilesPerRequest') : undefined;
    const points: PosWithHeight[] = req.body.positions;

    if (points.length === 0) {
      logger.error({ msg: 'Points array is empty.', pointsNumber: points.length, location: '[validateRequestMiddleware]', ...res.locals.reqCtx });
      throw commonErrors.EMPTY_POSITIONS_ARRAY;
    }

    // Decided to limit number of POINTS in order to points(API) behave consistantly
    // POINT <===> TILE
    if (typeof MAXIMUM_TILES_PER_REQUEST !== 'undefined' && points.length > MAXIMUM_TILES_PER_REQUEST) {
      logger.error({ msg: 'Too many points', pointsNumber: points.length, location: '[validateRequestMiddleware]', ...res.locals.reqCtx });
      throw commonErrors.TOO_MANY_POINTS_ERROR;
    }

    next();
  };
};
