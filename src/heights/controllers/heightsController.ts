import { RequestHandler } from 'express';
import { Cartographic } from 'cesium';
import { injectable, inject } from 'tsyringe';
import { HeightsManager } from '../models/heightsManager';
import { AdditionalFieldsEnum, PosWithHeight, TerrainTypes } from '../interfaces';
import { CommonErrors } from '../../common/commonErrors';

export interface GetHeightsPointsRequest {
  positions: Cartographic[];
  productType?: TerrainTypes;
  excludeFields?: AdditionalFieldsEnum[];
}

export interface GetHeightsPointsResponse {
  data: PosWithHeight[];
}

export type GetHeightsHandler = RequestHandler<undefined, GetHeightsPointsResponse | Uint8Array, GetHeightsPointsRequest>;

@injectable()
export class HeightsController {
  public constructor(
    @inject(HeightsManager) private readonly manager: HeightsManager,
    @inject(CommonErrors) private readonly commonErrors: CommonErrors
  ) {}

  public getPoints: GetHeightsHandler = async (req, res, next) => {
    try {
      const userInput = req.body;
      const reqCtx = res.locals.reqCtx as Record<string, unknown>;
      const DEFAULT_TERRAIN_TYPE = TerrainTypes.MIXED;

      const heights = await this.manager.getPoints(
        userInput.positions,
        userInput.productType ?? DEFAULT_TERRAIN_TYPE,
        userInput.excludeFields,
        reqCtx
      );

      res.locals.positions = heights;
      next();
    } catch (err) {
      next(err);
    }
  };

  // public getPath: GetHeightsHandler = async (req, res, next) => {
  //   try {
  //     const userInput: GeoJSON = req.body;
  //     const heights = await this.manager.getPath(userInput);
  //     return res.status(httpStatus.OK).json(heights);
  //   } catch (err) {
  //     next(err);
  //   }
  // };

  // public getPolygon: GetHeightsHandler = async (req, res, next) => {
  //   try {
  //     const userInput: GeoJSON = req.body;
  //     const heights = await this.manager.getPolygon(userInput);
  //     return res.status(httpStatus.OK).json(heights);
  //   } catch (err) {
  //     next(err);
  //   }
  // };

  // public getHeights: GetHeightsHandler = async (req, res, next) => {
  //   try {
  //     const userInput: GeoJSON = req.body;
  //     const heights = await this.manager.getHeights(userInput);
  //     return res.status(httpStatus.OK).json(heights);
  //   } catch (err) {
  //     next(err);
  //   }
  // };

  // public getHeight: GetHeightHandler = async (req, res, next) => {
  //   try {
  //     const height: IHeightModel = await this.manager.getHeight(req.params); // 35.076, 32.675
  //     return res.status(httpStatus.OK).json(height);
  //   } catch (err) {
  //     next(err);
  //   }
  // };
}
