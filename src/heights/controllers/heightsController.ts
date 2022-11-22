import { RequestHandler } from 'express';
import { GeoJSON } from 'geojson';
import httpStatus from 'http-status-codes';
import { injectable, inject } from 'tsyringe';
import { Logger } from '@map-colonies/js-logger';
import { Meter } from '@map-colonies/telemetry';
import { SERVICES } from '../../common/constants';
import { IHeightModel, HeightsManager, ICoordinates } from '../models/heightsManager';


type GetHeightsHandler = RequestHandler<ICoordinates, IHeightModel>;
type GetHeightsListHandler = RequestHandler<undefined, GeoJSON, GeoJSON>;

@injectable()
export class HeightsController {

  public constructor(
    @inject(SERVICES.LOGGER) private readonly logger: Logger,
    @inject(HeightsManager) private readonly manager: HeightsManager,
    @inject(SERVICES.METER) private readonly meter: Meter
  ) {
  }

  public getHeights: GetHeightsHandler = async (req, res, next) => {
    try {
      const height: IHeightModel = await this.manager.getHeights(req.params); // 35.076, 32.675
      return res.status(httpStatus.OK).json(height);
    } catch (err) {
      next(err);
    }
  };

  public getHeightsList: GetHeightsListHandler = async (req, res, next) => {
    try {
      const userInput: GeoJSON = req.body;
      const heights = await this.manager.getHeightsList(userInput);
      return res.status(httpStatus.OK).json(heights);
    } catch (err) {
      next(err);
    }
  };
}
