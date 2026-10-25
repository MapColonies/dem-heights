/* eslint-disable @typescript-eslint/naming-convention */
import httpStatusCodes from 'http-status-codes';
import { HttpError } from '@map-colonies/error-express-handler';
import { Logger } from '@map-colonies/js-logger';
import { ErrorRequestHandler } from 'express';
import { inject, singleton } from 'tsyringe';
import { SERVICES } from './constants';

export interface HttpErrorWithCode extends HttpError {
  message: string;
  errorCode: string;
  status: number;
}

export enum CommonErrorCodes {
  TOO_MANY_POINTS_ERROR = 'TOO_MANY_POINTS_ERROR',
  POINTS_DENSITY_TOO_LOW_ERROR = 'POINTS_DENSITY_TOO_LOW_ERROR',
  GENERAL_ERROR = 'GENERAL_ERROR',
  EMPTY_POSITIONS_ARRAY = 'EMPTY_POSITIONS_ARRAY',
  MISSING_REQUIRED_PROPERTY = 'MISSING_REQUIRED_PROPERTY',
  INVALID_REQUEST = 'INVALID_REQUEST',
  UNKNOWN_CATALOG_ITEM = 'UNKNOWN_CATALOG_ITEM',
  CATALOG_ITEM_NOT_READY = 'CATALOG_ITEM_NOT_READY',
  POINT_OUTSIDE_CATALOG_ITEM_COVERAGE = 'POINT_OUTSIDE_CATALOG_ITEM_COVERAGE',
}

export const commonErrorCodesToStatusMap = new Map([
  [CommonErrorCodes.GENERAL_ERROR, httpStatusCodes.INTERNAL_SERVER_ERROR],
  [CommonErrorCodes.POINTS_DENSITY_TOO_LOW_ERROR, httpStatusCodes.BAD_REQUEST],
  [CommonErrorCodes.EMPTY_POSITIONS_ARRAY, httpStatusCodes.BAD_REQUEST],
  [CommonErrorCodes.MISSING_REQUIRED_PROPERTY, httpStatusCodes.BAD_REQUEST],
  [CommonErrorCodes.INVALID_REQUEST, httpStatusCodes.BAD_REQUEST],
  [CommonErrorCodes.UNKNOWN_CATALOG_ITEM, httpStatusCodes.BAD_REQUEST],
  [CommonErrorCodes.CATALOG_ITEM_NOT_READY, httpStatusCodes.SERVICE_UNAVAILABLE],
  [CommonErrorCodes.POINT_OUTSIDE_CATALOG_ITEM_COVERAGE, httpStatusCodes.BAD_REQUEST],
]);

@singleton()
export class CommonErrors {
  /**
   * A class to contain all of the service's common errors
   */
  public constructor(@inject(SERVICES.LOGGER) private readonly logger: Logger) {}

  public get TOO_MANY_POINTS_ERROR(): HttpErrorWithCode {
    const err = new Error(`Too many points`) as HttpErrorWithCode;
    err.status = httpStatusCodes.BAD_REQUEST;
    err.errorCode = CommonErrorCodes.TOO_MANY_POINTS_ERROR;

    return err;
  }

  public get POINTS_DENSITY_TOO_LOW_ERROR(): HttpErrorWithCode {
    const err = new Error(`Points density is too low to compute`) as HttpErrorWithCode;
    err.status = httpStatusCodes.BAD_REQUEST;
    err.errorCode = CommonErrorCodes.POINTS_DENSITY_TOO_LOW_ERROR;
    return err;
  }

  public get EMPTY_POSITIONS_ARRAY(): HttpErrorWithCode {
    const err = new Error(`Request's positions array must not be empty`) as HttpErrorWithCode;
    err.status = httpStatusCodes.BAD_REQUEST;
    err.errorCode = CommonErrorCodes.EMPTY_POSITIONS_ARRAY;
    return err;
  }

  public get UNKNOWN_CATALOG_ITEM(): HttpErrorWithCode {
    const err = new Error(`No catalog item with a GEOTIFF provider matches the given productId and catalogProductType`) as HttpErrorWithCode;
    err.status = httpStatusCodes.BAD_REQUEST;
    err.errorCode = CommonErrorCodes.UNKNOWN_CATALOG_ITEM;
    return err;
  }

  public get CATALOG_ITEM_NOT_READY(): HttpErrorWithCode {
    const err = new Error(`The selected catalog item exists but has no loaded provider yet`) as HttpErrorWithCode;
    err.status = httpStatusCodes.SERVICE_UNAVAILABLE;
    err.errorCode = CommonErrorCodes.CATALOG_ITEM_NOT_READY;
    return err;
  }

  public get POINT_OUTSIDE_CATALOG_ITEM_COVERAGE(): HttpErrorWithCode {
    const err = new Error(`A requested point is outside the selected catalog item's coverage`) as HttpErrorWithCode;
    err.status = httpStatusCodes.BAD_REQUEST;
    err.errorCode = CommonErrorCodes.POINT_OUTSIDE_CATALOG_ITEM_COVERAGE;
    return err;
  }

  public MISSING_REQUIRED_PROPERTY(propertyName: string): HttpErrorWithCode {
    const err = new Error(`Request's property ${propertyName} is a required property`) as HttpErrorWithCode;
    err.status = httpStatusCodes.BAD_REQUEST;
    err.errorCode = CommonErrorCodes.MISSING_REQUIRED_PROPERTY;
    return err;
  }

  public GENERAL_ERROR(e: Error): HttpErrorWithCode {
    const err = new Error(`Sorry, something went wrong`) as HttpErrorWithCode;
    err.status = httpStatusCodes.INTERNAL_SERVER_ERROR;
    err.errorCode = CommonErrorCodes.GENERAL_ERROR;
    this.logger.error(e, err.errorCode);
    return err;
  }

  public getCommonErrorHandlerMiddleware(): ErrorRequestHandler {
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    return (err: HttpErrorWithCode, req, res, next) => {
      // pino-http looks for this property for error info

      //@ts-ignore
      res.err = err;

      const applicationErrorCode: CommonErrorCodes = this.getErrorCode(err);

      res.status((err.status as number | undefined) ?? (commonErrorCodesToStatusMap.get(applicationErrorCode) as number)).send({
        message: err.message,
        errorCode: (err.errorCode as string | undefined) ?? applicationErrorCode,
        status: err.status,
        // stackTrace: process.env.NODE_ENV !== 'production' ? err.stack : {},
      });
    };
  }

  private getErrorCode(err: HttpErrorWithCode): CommonErrorCodes {
    const DEFAULT_REQUIRED_PROPERTY_KEYWORD = 'required property';
    switch (true) {
      case err.message.includes(DEFAULT_REQUIRED_PROPERTY_KEYWORD) && err.status === httpStatusCodes.BAD_REQUEST:
        return CommonErrorCodes.MISSING_REQUIRED_PROPERTY;
      case err.status === httpStatusCodes.BAD_REQUEST:
        return CommonErrorCodes.INVALID_REQUEST;
      default:
        return CommonErrorCodes.GENERAL_ERROR;
    }
  }
}
