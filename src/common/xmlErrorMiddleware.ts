/* eslint-disable @typescript-eslint/no-unnecessary-condition */
import { HttpError } from '@map-colonies/error-express-handler';
import { StatusCodes, getReasonPhrase } from 'http-status-codes';
import { ErrorRequestHandler, NextFunction } from 'express';

export const getXmlErrorHandlerMiddleware: () => ErrorRequestHandler = () => {
  const mapColoniesErrorExpressHandler: ErrorRequestHandler = (
    err: HttpError,
    req,
    res,
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    next: NextFunction
  ): void => {
    res.err = err;
    const responseStatusCode = err.statusCode ?? err.status ?? StatusCodes.INTERNAL_SERVER_ERROR;
    res.setHeader('Content-Type', 'application/xml');
    res.status(responseStatusCode)
      .send(`<?xml version="1.0" encoding="UTF-8"?><ows:ExceptionReport xmlns:xs="http://www.w3.org/2001/XMLSchema" xmlns:ows="http://www.opengis.net/ows/2.0" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" version="2.0.0" xsi:schemaLocation="http://www.opengis.net/ows/2.0 http://schemas.opengis.net/ows/2.0/owsExceptionReport.xsd">
    <ows:Exception locator="request">
    <ows:ExceptionText>${err.message ?? getReasonPhrase(responseStatusCode)}</ows:ExceptionText>
    </ows:Exception>
    </ows:ExceptionReport>`);
  };

  return mapColoniesErrorExpressHandler;
};