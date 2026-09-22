/* eslint-disable @typescript-eslint/no-unsafe-return */
import config from 'config';
import { Application } from 'express';
import httpStatusCodes from 'http-status-codes';
import jsLogger from '@map-colonies/js-logger';
import { container } from 'tsyringe';
import { PycswDemCatalogRecord } from '@map-colonies/mc-model-types';
import { getApp } from '../../../src/app';
import { SERVICES } from '../../../src/common/constants';
import { CATALOG_RECORDS_MAP, CATALOG_SYNC_MANAGER, DEM_TERRAIN_CACHE_MANAGER } from '../../../src/containerConfig';
import { GetHeightsPointsRequest, GetHeightsPointsResponse } from '../../../src/heights/controllers/heightsController';
import { PosWithHeight, TerrainTypes } from '../../../src/heights/interfaces';
import { CatalogRecords } from '../../../src/heights/models/catalogRecords';
import DEMTerrainCacheManager from '../../../src/heights/models/DEMTerrainCacheManager';
import GeotiffHeightProvider from '../../../src/heights/models/geotiffHeightProvider';
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
  let productMetadataFields: string[];

  const basicPositionResponse: PosWithHeight = {
    latitude: 0,
    longitude: 0,
    height: 0,
    productId: 'dummy_product_id',
  } as PosWithHeight;

  beforeAll(async function () {
    productMetadataFields = config.get<string>('productMetadataFields').split(',');

    const app = await getApp({
      override: [
        { token: SERVICES.LOGGER, provider: { useValue: jsLogger({ enabled: false }) } },
        { token: CATALOG_SYNC_MANAGER, provider: { useValue: { start: (): void => undefined, stop: (): void => undefined } } },
      ],
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

      it('should default productType to MIXED when it is omitted', async function () {
        const response = await requestSender.getPoints({ positions: mockJsonData.positions } as GetHeightsPointsRequest);

        expect(response.status).toBe(httpStatusCodes.OK);
        expect((response.body as GetHeightsPointsResponse).data).toHaveLength(mockJsonData.positions.length);
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

  describe('Given seeded geotiff providers', function () {
    beforeAll(async function () {
      jest.spyOn(GeotiffHeightProvider, 'fromUrl').mockResolvedValue({
        sample: async (points: { longitude: number; latitude: number }[]) => points.map(() => 123),
      } as unknown as GeotiffHeightProvider);

      const records = [
        {
          id: 'rec1',
          productId: 'test_prod',
          productType: 'DTM',
          resolutionMeter: 30,
          updateDate: '2023-05-08T17:44:01.000Z',
          absoluteAccuracyLEP90: 9e-7,
          productStatus: 'PUBLISHED',
          footprint: {
            type: 'Polygon',
            coordinates: [
              [
                [34, 32],
                [34, 33],
                [36, 33],
                [36, 32],
                [34, 32],
              ],
            ],
          },
          links: [{ protocol: 'GEOTIFF', url: 'https://tiles-dev.mapcolonies.net/api/dem/v1/cogs/a.tif' }],
        },
      ];

      container
        .resolve<CatalogRecords>(CATALOG_RECORDS_MAP)
        .setValue(Object.fromEntries(records.map((r) => [r.id, r])) as unknown as Record<string, PycswDemCatalogRecord>);
      await container.resolve<DEMTerrainCacheManager>(DEM_TERRAIN_CACHE_MANAGER).initProviders(records as unknown as PycswDemCatalogRecord[]);
    });

    afterAll(function () {
      container.resolve<CatalogRecords>(CATALOG_RECORDS_MAP).setValue({});
      jest.restoreAllMocks();
    });

    it('returns real heights, productId, and products metadata for a point inside a footprint', async function () {
      const response = await requestSender.getPoints({ positions: [{ longitude: 35.0, latitude: 32.5 }] } as GetHeightsPointsRequest);

      expect(response.status).toBe(httpStatusCodes.OK);
      const body = response.body as GetHeightsPointsResponse;
      expect(body.data).toHaveLength(1);
      expect(body.data[0].height).toBe(123);
      expect(body.data[0].productId).toBe('test_prod');
      expect(body.products['test_prod']).toBeDefined();
      ['productType', 'updateDate', 'resolutionMeter', 'absoluteAccuracyLEP90'].forEach((field) => {
        expect((body.products['test_prod'] as Record<string, unknown>)[field]).toBeDefined();
      });
    });
  });
});
