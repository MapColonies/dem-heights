/* eslint-disable @typescript-eslint/naming-convention */
import fs from "fs/promises";
import path from "path";
import { Cartographic, Math as CesiumMath, Rectangle } from "cesium";
import { RequestHandler } from "express";
import { GetHeightsPointsRequest } from "../controllers/heightsController";

type GenerateJsonPointsRequest = RequestHandler<
    undefined,
    GetHeightsPointsRequest,
    undefined,
    {coordinate: string, pointsCount?: number}
>;

function generatePositions(coordinate: string, numberOfPoints: number): GetHeightsPointsRequest {
    
    // A magic number to spread points across ~100 terrain tiles.
    const rectangleHalfSize = 0.2;

    // Generating 10K points.
    const gridWidth = Math.floor(Math.sqrt(numberOfPoints));
    const gridHeight = Math.floor(Math.sqrt(numberOfPoints));

    const [reqLatitude, reqLongitude] = coordinate.split(' ');

    const e = new Rectangle(
        +reqLongitude - rectangleHalfSize,
        +reqLatitude - rectangleHalfSize,
        +reqLongitude + rectangleHalfSize,
        +reqLatitude + rectangleHalfSize
    );
    const terrainSamplePositions: Cartographic[] = [];
    for (let y = 0; y < gridHeight; ++y) {
        for (let x = 0; x < gridWidth; ++x) {
            const longitude = CesiumMath.lerp(e.west, e.east, x / (gridWidth - 1));
            const latitude = CesiumMath.lerp(e.south, e.north, y / (gridHeight - 1));
            const position = new Cartographic(longitude, latitude);

            terrainSamplePositions.push({latitude: position.latitude, longitude: position.longitude } as Cartographic);
        }
    }
    return { positions: terrainSamplePositions };
}

export const generateJsonPointsMiddleware: () => GenerateJsonPointsRequest = () => {
    return (req, res, next) => {
        const POSITIONS_MOCK = generatePositions(req.query.coordinate, req.query.pointsCount as number);
        
        // void fs.writeFile('./coordinates.json', JSON.stringify(POSITIONS_MOCK), {encoding: 'utf-8'})
        res.json(POSITIONS_MOCK);
    };
};
