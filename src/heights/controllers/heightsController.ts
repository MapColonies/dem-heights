import { RequestHandler } from "express";
import { Cartographic } from "cesium";
import { injectable, inject } from "tsyringe";
import { Logger } from "@map-colonies/js-logger";
import { Meter } from "@map-colonies/telemetry";
import { SERVICES } from "../../common/constants";
import { HeightsManager } from "../models/heightsManager";
import { PosWithHeight } from "../interfaces";

export interface GetHeightsPointsRequest {
    positions: Cartographic[];
}

export interface GetHeightsPointsResponse {
    data: PosWithHeight[];
}

export type GetHeightsHandler = RequestHandler<
    undefined,
    GetHeightsPointsResponse | Uint8Array,
    GetHeightsPointsRequest
>;
// type GetHeightHandler = RequestHandler<ICoordinates, IHeightModel>;

@injectable()
export class HeightsController {
    public constructor(
        @inject(SERVICES.LOGGER) private readonly logger: Logger,
        @inject(HeightsManager) private readonly manager: HeightsManager,
        @inject(SERVICES.METER) private readonly meter: Meter
    ) {}

    public getPoints: GetHeightsHandler = async (req, res, next) => {
        try {
            const userInput = req.body;
            const heights = await this.manager.getPoints(userInput.positions);
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
