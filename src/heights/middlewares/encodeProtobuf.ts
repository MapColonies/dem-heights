import protobuf from "protobufjs";
import { Logger } from "@map-colonies/js-logger";
import { PosWithHeight } from "../interfaces";
import { GetHeightsHandler } from "../controllers/heightsController";

export const encodeProtobufMiddleware: (protobufClass: protobuf.Type, logger: Logger) => GetHeightsHandler = (
    protobufClass,
    logger,
) => {
    return (req, res, next) => {
        const startTime = performance.now();
       
        // We should return data the same way its requested.
        if (req.headers["content-type"] === "application/octet-stream") {
            const encodedData = protobufClass
            .encode({ data: res.locals.positions as PosWithHeight[] })
            .finish();
            
            const endTime = performance.now();
    
            logger.debug({protobufEncodeTime: endTime - startTime, location: '[encodeProtobufMiddleware]' , reqId: res.locals.reqId as string })
                    
            res.send(encodedData);
            return;
        }
        res.send({ data: res.locals.positions as PosWithHeight[] });
    };
};
