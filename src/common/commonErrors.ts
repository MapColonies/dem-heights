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

export enum CommonErrorCodes {
    POINTS_DENSITY_TOO_LOW_ERROR = "POINTS_DENSITY_TOO_LOW_ERROR",
    GENERAL_SERVER_ERROR = "GENERAL_SERVER_ERROR",
    EMPTY_POSITIONS_ARRAY = "EMPTY_POSITIONS_ARRAY",
    MISSING_REQUIRED_PROPERTY = "MISSING_REQUIRED_PROPERTY",
    INVALID_REQUEST = "INVALID_REQUEST",
}

export const commonErrorCodesToStatusMap = new Map([
    [CommonErrorCodes.GENERAL_SERVER_ERROR, httpStatusCodes.INTERNAL_SERVER_ERROR],
    [CommonErrorCodes.POINTS_DENSITY_TOO_LOW_ERROR, httpStatusCodes.BAD_REQUEST],
    [CommonErrorCodes.EMPTY_POSITIONS_ARRAY, httpStatusCodes.BAD_REQUEST],
    [CommonErrorCodes.MISSING_REQUIRED_PROPERTY, httpStatusCodes.BAD_REQUEST],
    [CommonErrorCodes.INVALID_REQUEST, httpStatusCodes.BAD_REQUEST],
])

@singleton()
export class CommonErrors {
    /**
     * A class to contain all of the service's common errors
     */
    public constructor(@inject(SERVICES.LOGGER) private readonly logger: Logger) {}

    public get POINTS_DENSITY_TOO_LOW_ERROR(): HttpErrorWithCode {
        const err = new Error(`Points density is too low to compute.`) as HttpErrorWithCode;
        err.status = httpStatusCodes.BAD_REQUEST;
        err.errorCode = CommonErrorCodes.POINTS_DENSITY_TOO_LOW_ERROR;

        return err;
    }

    public get EMPTY_POSITIONS_ARRAY(): HttpErrorWithCode {
        const err = new Error(`Request's positions array must not be empty.`) as HttpErrorWithCode;
        err.status = httpStatusCodes.BAD_REQUEST;
        err.errorCode = CommonErrorCodes.EMPTY_POSITIONS_ARRAY;

        return err;
    }

    public GENERAL_SERVER_ERROR(e: Error): HttpErrorWithCode {
        const err = new Error(`Sorry, something went wrong.`) as HttpErrorWithCode;

        err.status = httpStatusCodes.INTERNAL_SERVER_ERROR;
        err.errorCode = CommonErrorCodes.GENERAL_SERVER_ERROR;

        this.logger.error(e, err.errorCode);

        return err;
    }

    public getCommonErrorHandlerMiddleware(): ErrorRequestHandler {
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        return (err: HttpErrorWithCode, req, res, next) => {
            // pino-http looks for this property for error info
            res.err = err;

            const applicationErrorCode: CommonErrorCodes = this.getErrorCode(err);

            res.status(err.status as number | undefined ?? commonErrorCodesToStatusMap.get(applicationErrorCode) as number)
            .send({
                message: err.message,
                errorCode: err.errorCode as string | undefined ?? applicationErrorCode,
                status: err.status,
                stackTrace: process.env.NODE_ENV !== "production" ? err.stack : {}
            });
        };
    }

    private getErrorCode(err: HttpErrorWithCode): CommonErrorCodes {
        const DEFAULT_REQUIRED_PROPERTY_KEYWORD = 'required property'
        switch(true) {
            case err.message.includes(DEFAULT_REQUIRED_PROPERTY_KEYWORD) && err.status === httpStatusCodes.BAD_REQUEST:
                return CommonErrorCodes.MISSING_REQUIRED_PROPERTY
            case err.status === httpStatusCodes.BAD_REQUEST:
                return CommonErrorCodes.INVALID_REQUEST
            default:
                return CommonErrorCodes.GENERAL_SERVER_ERROR
        }
    }
}
