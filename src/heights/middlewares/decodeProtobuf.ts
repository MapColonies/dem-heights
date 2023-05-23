import protobuf from "protobufjs";
import { GetHeightsHandler, GetHeightsPointsRequest } from "../controllers/heightsController";

export const decodeProtobufMiddleware: (protobufClass: protobuf.Type) => GetHeightsHandler = (
    protobufClass
) => {
    return (req, res, next) => {
        // Check if payload is a binary data.
        if (req.headers["content-type"] === "application/octet-stream") {
            // body parser will transform req.body to a buffer if content type header represents binary data.
            const reqUintArray = new Uint8Array(req.body as unknown as ArrayBufferLike);
            const decodedData = protobufClass.decode(reqUintArray);
            req.body = decodedData.toJSON() as GetHeightsPointsRequest;
        }

        next();
    };
};
