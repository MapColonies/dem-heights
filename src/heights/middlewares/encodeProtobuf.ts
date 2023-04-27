import { RequestHandler } from "express";
import protobuf from 'protobufjs';
import { PosWithHeight } from "../interfaces";
import { GetHeightsHandler } from "../controllers/heightsController";

export const encodeProtobufMiddleware: (protobufClass: protobuf.Type) => GetHeightsHandler = (protobufClass) => {
    return (req, res, next) => {
        console.log(protobufClass.verify({data: res.locals.positions as PosWithHeight[]}))
        const encodedData = protobufClass.encode({data: res.locals.positions as PosWithHeight[]}).finish();

        // console.log(res.locals.positions)

        // const decode = protobufClass.decode(Buffer.from(encodedData));
        // @ts-ignore
        res.send(encodedData);
    }
};
