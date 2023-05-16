/* eslint-disable @typescript-eslint/naming-convention */
import fs from "fs/promises";
import path from "path";
import protobuf from "protobufjs";
import { RequestHandler } from "express";
import {
    GetHeightsPointsRequest,
    GetHeightsPointsResponse
} from "../controllers/heightsController";

type ProtoReqBinaryRequest = RequestHandler<
    undefined,
    GetHeightsPointsRequest,
    GetHeightsPointsResponse | Uint8Array
>;

export const generateProtoReqBinaryMiddleware: (
    protobufClass: protobuf.Type
) => ProtoReqBinaryRequest = (protobufClass) => {
    return (req, res, next) => {
        const encodedData = protobufClass.encode(req.body).finish();

        // void fs.writeFile(path.resolve(__dirname, "./aoiProtoReq.bin"), encodedData, {
        //     encoding: "utf-8"
        // });

        res.set({
            "Content-Type": "application/octet-stream",
            "Content-Disposition": "attachment; filename=protoRequest.bin"
        });

        res.end(encodedData);

        return;
    };
};
