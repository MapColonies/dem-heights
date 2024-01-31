/* eslint-disable @typescript-eslint/no-unsafe-return */
import path from 'path';
import fs from 'fs';
import config from 'config';
import { Cartesian2, Cartographic, CesiumTerrainProvider } from 'cesium';
import { Application } from 'express';
import httpStatusCodes from 'http-status-codes';
import jsLogger from '@map-colonies/js-logger';
import { getApp } from '../../../src/app';
import { SERVICES } from '../../../src/common/constants';
import { GetHeightsPointsRequest, GetHeightsPointsResponse } from '../../../src/heights/controllers/heightsController';
import { PosWithHeight, TerrainTypes } from '../../../src/heights/interfaces';
import mockJsonPoints, {
  emptyPositionsRequest,
  moreThen150RequestsPositions,
  positionsOutsideOfProviders,
} from '../../../src/heights/MOCKS/mockData';
import { CommonErrorCodes, HttpErrorWithCode } from '../../../src/common/commonErrors';
import { HeightsRequestSender } from './helpers/requestSender';

describe('heights', function () {
  const mockJsonData = mockJsonPoints as GetHeightsPointsRequest;
  const mockJsonDataLowDensity = moreThen150RequestsPositions as GetHeightsPointsRequest;
  const mockJsonDataOutOfBounds = positionsOutsideOfProviders as GetHeightsPointsRequest;

  let requestSender: HeightsRequestSender;
  let cesiumTerrainProviderFromUrlSpy: jest.SpyInstance;
  let productMetadataFields: string[];

  const basicPositionResponse: PosWithHeight = {
    latitude: 0,
    longitude: 0,
    height: 0,
    productId: 'dummy_product_id',
  } as PosWithHeight;

  beforeAll(async function () {
    productMetadataFields = config.get<string>('productMetadataFields').split(',');

    cesiumTerrainProviderFromUrlSpy = jest.spyOn(CesiumTerrainProvider, 'fromUrl');

    cesiumTerrainProviderFromUrlSpy.mockReturnValue({
      availability: {
        available: true,
        computeMaximumLevelAtPosition: () => {
          return 13;
        },
      },
      tilingScheme: {
        positionToTileXY: (position: Cartographic) => {
          // Making sure there are no overlapping tiles for any of the given positions,
          // so that each position is a "request"
          // (Assuming unique positions)
          return new Cartesian2(position.latitude, position.longitude);
        },
      },
    });

    const app = await getApp({
      override: [{ token: SERVICES.LOGGER, provider: { useValue: jsLogger({ enabled: false }) } }],
    });

    requestSender = new HeightsRequestSender(app as Application);
  });

  describe('Given valid params', function () {
    describe('Get points height (JSON)', function () {
      it('should return 200 status code and points heights for basic usage', async function () {
        const response = await requestSender.getPoints(mockJsonData);

        expect(response.status).toBe(httpStatusCodes.OK);
        expect(response.body).toHaveProperty('data');
        expect(response.body).toHaveProperty('products');
        expect((response.body as GetHeightsPointsResponse).data).toHaveLength(mockJsonData.positions.length);

        // const getHeightsResProperties = Object.keys(basicPositionResponse);

        // for (const position of (response.body as GetHeightsPointsResponse).data) {
        //   for (const key of getHeightsResProperties) {
        //     expect(position[key as keyof PosWithHeight]).toBeTruthy();
        //   }
        // }
      });

      it('should return 200 status code and points heights with products dictionary', async function () {
        const response = await requestSender.getPoints({
          ...mockJsonData,
        });

        expect(response.status).toBe(httpStatusCodes.OK);
        expect(response.body).toHaveProperty('data');
        expect(response.body).toHaveProperty('products');
        expect((response.body as GetHeightsPointsResponse).data).toHaveLength(mockJsonData.positions.length);

        Object.values((response.body as GetHeightsPointsResponse).products as Record<string, Record<string, unknown>>).forEach((product) => {
          productMetadataFields.forEach((field) => {
            expect(product[field]).toBeDefined();
          });
        });
      });

      it('Should return 200 status code and the positions with null heights and no fields if no provider match for the request (Legit request)', async function () {
        const nonExistingTerrainType = TerrainTypes.DSM;

        const response = await requestSender.getPoints({
          ...mockJsonData,
          productType: nonExistingTerrainType,
        });

        expect(response.status).toBe(httpStatusCodes.OK);
        expect(response.body).toHaveProperty('data');
        expect((response.body as GetHeightsPointsResponse).data).toHaveLength(mockJsonData.positions.length);

        for (const position of (response.body as GetHeightsPointsResponse).data) {
          expect(position.height).toBeNull();

          expect(position['productId']).toBeUndefined();
        }
      });

      it('should return 200 status code even if some points are not in any provider', async function () {
        /**
         * If a position could not be found in any provider, its height will be null and will not include any extra field.
         */
        const response = await requestSender.getPoints(mockJsonDataOutOfBounds);

        expect(response.status).toBe(httpStatusCodes.OK);
        expect(response.body).toHaveProperty('data');
        expect((response.body as GetHeightsPointsResponse).data).toHaveLength(mockJsonDataOutOfBounds.positions.length);

        for (const position of (response.body as GetHeightsPointsResponse).data) {
          expect(position['latitude'] && position['longitude']).toBeDefined();

          const isNullHeight = (position.height as number | null) === null;

          expect(typeof position['productId'] === 'undefined').toEqual(isNullHeight);
        }
      });
    });

    describe('Get points height (PROTO)', function () {
      it('should return 200 status code and points heights for basic usage', async function () {
        const MOCK_PROTO_FILE_RELATIVE_PATH = '../../../src/heights/MOCKS/protoReq.bin';
        const protoFile = fs.readFileSync(path.resolve(__dirname, MOCK_PROTO_FILE_RELATIVE_PATH), null);

        const response = await requestSender.getPointsProtobuf(protoFile);

        expect(response.status).toBe(httpStatusCodes.OK);
        expect(response.type).toBe('application/octet-stream');

        // TODO: should decode returned protobuf data and check as json?
      });
    });
  });

  describe('Given invalid params', function () {
    describe('Get points height (JSON)', function () {
      it('Should return 400 status code with low density error for 150+ requests (As configured)', async function () {
        const response = await requestSender.getPoints(mockJsonDataLowDensity);

        expect(response.status).toBe(httpStatusCodes.BAD_REQUEST);
        expect(response.body).toHaveProperty('errorCode');
        expect((response.body as HttpErrorWithCode).errorCode).toBe(CommonErrorCodes.TOO_MANY_POINTS_ERROR);
      });

      it('Should return 400 status code with an empty positions error if positions array is empty', async function () {
        const response = await requestSender.getPoints(emptyPositionsRequest);

        expect(response.status).toBe(httpStatusCodes.BAD_REQUEST);
        expect(response.body).toHaveProperty('errorCode');
        expect((response.body as HttpErrorWithCode).errorCode).toBe(CommonErrorCodes.EMPTY_POSITIONS_ARRAY);
      });
    });
  });
});
