import { Logger } from '@map-colonies/js-logger';
import { Meter } from '@map-colonies/telemetry';
import { RequestHandler } from 'express';
import httpStatus from 'http-status-codes';
import { injectable, inject } from 'tsyringe';
import { SERVICES } from '../../common/constants';

import { IHeightModel, HeightsManager } from '../models/heightsManager';

type GetHeightsListHandler = RequestHandler<undefined, IHeightModel, IHeightModel>;
type GetHeightsHandler = RequestHandler<undefined, IHeightModel>;

@injectable()
export class HeightsController {

  public constructor(
    @inject(SERVICES.LOGGER) private readonly logger: Logger,
    @inject(HeightsManager) private readonly manager: HeightsManager,
    @inject(SERVICES.METER) private readonly meter: Meter
  ) {
  }

  public getHeights: GetHeightsHandler = (req, res) => {
    return res.status(httpStatus.OK).json(this.manager.getHeights());
  };

  public getHeightsList: GetHeightsListHandler = (req, res) => {
    const heights = this.manager.getHeightsList(req.body);
    return res.status(httpStatus.OK).json(heights);
  };
}
