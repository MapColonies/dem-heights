/* eslint-disable @typescript-eslint/naming-convention */
import httpStatusCodes from "http-status-codes";
import { HttpError } from "@map-colonies/error-express-handler";
import { Logger } from "@map-colonies/js-logger";
import { ErrorRequestHandler } from "express";
import { inject, singleton } from "tsyringe";
import { SERVICES } from "./constants";

export interface HttpErrorWithCode extends HttpError {
    message: string;
    errorCode: string;
    status: number;
}

@singleton()
export class CommonErrors {
    /**
     * A class to contain all of the service's common errors
     */
    public constructor(@inject(SERVICES.LOGGER) private readonly logger: Logger) {}

    public get POINTS_DENSITY_TOO_LOW_ERROR(): HttpErrorWithCode {
        const err = new Error(`Points density is too low to compute.`) as HttpErrorWithCode;
        err.status = httpStatusCodes.BAD_REQUEST;
        err.errorCode = "POINTS_DENSITY_TOO_LOW_ERROR";

        return err;
    }

    public GENERAL_SERVER_ERROR(e: Error): HttpErrorWithCode {
        const err = new Error(`Sorry, something went wrong.`) as HttpErrorWithCode;

        err.status = httpStatusCodes.INTERNAL_SERVER_ERROR;
        err.errorCode = "GENERAL_SERVER_ERROR";

        this.logger.error(e, err.errorCode);

        return err;
    }

    public getCommonErrorHandlerMiddleware(): ErrorRequestHandler {
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        return (err: HttpErrorWithCode, req, res, next) => {
            // pino-http looks for this property for error info
            res.err = err;

            res.status(err.status as number | undefined ?? httpStatusCodes.INTERNAL_SERVER_ERROR).send({
                message: err.message,
                errorCode: err.errorCode,
                status: err.status,
                stackTrace: process.env.NODE_ENV !== "production" ? err.stack : {}
            });
        };
    }
}
