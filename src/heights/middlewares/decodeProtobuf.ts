import { Cartographic } from "cesium";
import protobuf from 'protobufjs';
import { GetHeightsHandler } from "../controllers/heightsController";

export const decodeProtobufMiddleware: (protobufClass: protobuf.Type) => GetHeightsHandler = (protobufClass) => {
    return (req, res, next) => {
        const encodedData = protobufClass.decode(Buffer.from(req.body as unknown as ArrayBuffer));
        req.body = encodedData.toJSON() as Cartographic[];
        
        next();
    }
};
