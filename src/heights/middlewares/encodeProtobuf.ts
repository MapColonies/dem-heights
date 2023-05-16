import protobuf from "protobufjs";
import { PosWithHeight } from "../interfaces";
import { GetHeightsHandler } from "../controllers/heightsController";

export const encodeProtobufMiddleware: (protobufClass: protobuf.Type) => GetHeightsHandler = (
    protobufClass
) => {
    return (req, res, next) => {
        // We should return data the same way its requested.
        if (req.headers["content-type"] === "application/octet-stream") {
            const encodedData = protobufClass
                .encode({ data: res.locals.positions as PosWithHeight[] })
                .finish();

            res.send(encodedData);
            return;
        }

        res.send({ data: res.locals.positions as PosWithHeight[] });
    };
};
