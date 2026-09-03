import { Logger } from '@map-colonies/js-logger';
import { PycswDemCatalogRecord } from '@map-colonies/mc-model-types';
import { NextFunction, Request, Response } from 'express';
import { container } from 'tsyringe';
import { isUuid } from 'uuidv4';
import { CommonErrors } from '../../../../src/common/commonErrors';
import { SERVICES } from '../../../../src/common/constants';
import { IConfig } from '../../../../src/common/interfaces';
import { CATALOG_RECORDS_MAP, PRODUCT_METADATA_FIELDS } from '../../../../src/containerConfig';
import { GetHeightsHandler } from '../../../../src/heights/controllers/heightsController';
import { addProductsDictionaryMiddleware } from '../../../../src/heights/middlewares/addProductsDictionary';
import { createReqCtxMiddleware } from '../../../../src/heights/middlewares/createReqCtx';
import { validateRequestMiddleware } from '../../../../src/heights/middlewares/validateRequest';
import { CatalogRecords } from '../../../../src/heights/models/catalogRecords';
import { registerTestValues } from '../../../configurations/testContainerConfig';

describe('Get heights middlewares', function () {
  let mockRequest: Request;
  let mockResponse: Response;
  let mockNext: NextFunction;
  let logger: Logger;
  let config: IConfig;
  let commonErrors: CommonErrors;
  let reqCtxMiddleware: GetHeightsHandler;
  let reqValidateMiddleware: GetHeightsHandler;
  let addProdDictionaryMiddleware: GetHeightsHandler;
  let productMetadataFields: string[];

  beforeAll(async function () {
    await registerTestValues(false);
    logger = container.resolve(SERVICES.LOGGER);
    config = container.resolve(SERVICES.CONFIG);
    commonErrors = container.resolve(CommonErrors);

    productMetadataFields = container.resolve(PRODUCT_METADATA_FIELDS);

    reqCtxMiddleware = createReqCtxMiddleware(logger);
    reqValidateMiddleware = validateRequestMiddleware(config, logger, commonErrors);
    addProdDictionaryMiddleware = addProductsDictionaryMiddleware(logger, productMetadataFields);
  });

  describe('Create request id middleware', function () {
    beforeEach(function () {
      mockResponse = {
        locals: {},
      } as Response;

      mockRequest = {
        body: {},
      } as Request;

      mockNext = jest.fn();
    });

    it('Should attach reqCtx property to res.locals object', function () {
      // @ts-ignore
      reqCtxMiddleware(mockRequest, mockResponse, mockNext);

      expect(mockResponse.locals.reqCtx).toBeDefined();
      expect(isUuid((mockResponse.locals.reqCtx as Record<string, unknown>).reqId as string)).toBeTruthy();
    });
  });

  describe('Add products dictionary', function () {
    beforeEach(function () {
      mockResponse = {
        locals: {
          positions: [],
        },
      } as unknown as Response;

      mockRequest = {
        body: {},
      } as Request;

      mockNext = jest.fn();
    });

    it('Should receive res.locals and attach back products dictionary', function () {
      // @ts-ignore
      addProdDictionaryMiddleware(mockRequest, mockResponse, mockNext);

      expect(mockResponse.locals.products).toBeDefined();

      Object.values(mockResponse.locals.products as Record<string, Record<string, unknown>>).forEach((product) => {
        productMetadataFields.forEach((field) => {
          expect(product[field]).toBeDefined();
        });
      });
    });
  });

  describe('Validate request middleware', function () {
    beforeEach(function () {
      mockResponse = { locals: {} } as unknown as Response;

      mockNext = jest.fn();
    });

    it('Should throw EMPTY_POSITIONS_ARRAY exception', function () {
      mockRequest = { body: { positions: [] } } as unknown as Request;
      expect(() => {
        // @ts-ignore
        reqValidateMiddleware(mockRequest, mockResponse, mockNext);
      }).toThrow(commonErrors.EMPTY_POSITIONS_ARRAY);
    });

    it('Should throw TOO_MANY_POINTS_ERROR exception', function () {
      mockRequest = {
        body: {
          positions: Array(255).fill({
            longitude: 86.82918540404042,
            latitude: 27.888257,
          }),
        },
      } as unknown as Request;
      expect(() => {
        // @ts-ignore
        reqValidateMiddleware(mockRequest, mockResponse, mockNext);
      }).toThrow(commonErrors.TOO_MANY_POINTS_ERROR);
    });
  });
});
