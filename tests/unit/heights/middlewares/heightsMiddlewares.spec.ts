import { Logger } from '@map-colonies/js-logger';
import { PycswDemCatalogRecord } from '@map-colonies/mc-model-types';
import { Cartographic } from 'cesium';
import { NextFunction, Request, Response } from 'express';
import { container } from 'tsyringe';
import { isUuid } from 'uuidv4';
import { CommonErrors } from '../../../../src/common/commonErrors';
import { SERVICES } from '../../../../src/common/constants';
import { IConfig } from '../../../../src/common/interfaces';
import { CATALOG_RECORDS_MAP, PRODUCT_METADATA_FIELDS } from '../../../../src/containerConfig';
import { GetHeightsHandler, GetHeightsPointsRequest } from '../../../../src/heights/controllers/heightsController';
import { PosWithHeight } from '../../../../src/heights/interfaces';
import { addProductsDictionaryMiddleware } from '../../../../src/heights/middlewares/addProductsDictionary';
import { createReqCtxMiddleware } from '../../../../src/heights/middlewares/createReqCtx';
import { positionResAsDegreesMiddleware } from '../../../../src/heights/middlewares/dataToDegrees';
import { convertReqPositionToRadiansMiddleware } from '../../../../src/heights/middlewares/dataToRadians';
import { validateRequestMiddleware } from '../../../../src/heights/middlewares/validateRequest';
import { registerTestValues } from '../../../configurations/testContainerConfig';

describe('Get heights middlewares', function () {
  let mockRequest: Request;
  let mockResponse: Response;
  let mockNext: NextFunction;
  let logger: Logger;
  let config: IConfig;
  let commonErrors: CommonErrors;
  let reqCtxMiddleware: GetHeightsHandler;
  let dataToRadiansMiddleware: GetHeightsHandler;
  let dataToDegreesMiddleware: GetHeightsHandler;
  let reqValidateMiddleware: GetHeightsHandler;
  let addProdDictionaryMiddleware: GetHeightsHandler;
  let catalogRecordsMap:  Record<string, PycswDemCatalogRecord>;
  let productMetadataFields: string[];
  

  beforeAll(async function () {
    await registerTestValues(false);
    logger = container.resolve(SERVICES.LOGGER);
    config = container.resolve(SERVICES.CONFIG);
    commonErrors = container.resolve(CommonErrors);

    catalogRecordsMap = container.resolve(CATALOG_RECORDS_MAP);
    productMetadataFields = container.resolve(PRODUCT_METADATA_FIELDS);

    reqCtxMiddleware = createReqCtxMiddleware(logger);
    dataToRadiansMiddleware = convertReqPositionToRadiansMiddleware(logger);
    dataToDegreesMiddleware = positionResAsDegreesMiddleware(logger);
    reqValidateMiddleware = validateRequestMiddleware(config, logger, commonErrors);
    addProdDictionaryMiddleware = addProductsDictionaryMiddleware(logger, catalogRecordsMap, productMetadataFields);
  });

  describe('Create request id middleware', function () {
    beforeEach(function () {
      mockResponse = {
        locals: {},
      } as Response;

      mockRequest = {
        body: {
          radiansToOriginalPositionsMap: new Map(),
        },
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

  describe('Data to radians middleware', function () {
    const position = { longitude: 86.82918540404042, latitude: 27.888257 };
    const expectedResponseInRadians = {
      longitude: 1.5154551721251082,
      latitude: 0.4867419072923562,
      height: 0,
    } as Cartographic;

    beforeEach(function () {
      mockResponse = {
        locals: {},
      } as Response;

      mockRequest = {
        body: {
          positions: [position],
          radiansToOriginalPositionsMap: new Map([
            [`${expectedResponseInRadians.longitude};${expectedResponseInRadians.latitude}`, `${position.longitude};${position.latitude}`],
          ]),
        },
      } as Request;

      mockNext = jest.fn();
    });

    it('Should receive positions array via req.body.positions and attach back positions in radians', function () {
      // @ts-ignore
      dataToRadiansMiddleware(mockRequest, mockResponse, mockNext);
      expect((mockRequest.body as GetHeightsPointsRequest).positions[0]).toEqual(expectedResponseInRadians);
    });
  });

  describe('Data to degrees middleware', function () {
    const positionInRadians = { longitude: 1.5154551721251082, latitude: 0.4867419072923562 };
    const expectedResponseInDegrees = {
      longitude: 86.82918540404042,
      latitude: 27.888257,
    } as Cartographic;

    beforeEach(function () {
      mockResponse = {
        locals: {
          positions: [positionInRadians],
        },
      } as unknown as Response;

      mockRequest = {
        body: {
          radiansToOriginalPositionsMap: new Map([
            [
              `${positionInRadians.longitude};${positionInRadians.latitude}`,
              `${expectedResponseInDegrees.longitude};${expectedResponseInDegrees.latitude}`,
            ],
          ]),
        },
      } as Request;

      mockNext = jest.fn();
    });

    it('Should receive positions array via res.locals.positions and attach back positions in degrees', function () {
      // @ts-ignore
      dataToDegreesMiddleware(mockRequest, mockResponse, mockNext);

      expect((mockResponse.locals.positions as PosWithHeight[])[0]).toEqual(expectedResponseInDegrees);
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

      
      Object.values(mockResponse.locals.products as Record<string,Record<string,unknown>>).forEach((product) => {
        productMetadataFields.forEach(field => {
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
