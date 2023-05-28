/* eslint-disable @typescript-eslint/no-unsafe-return */
/* eslint-disable @typescript-eslint/no-unsafe-assignment */
import jsLogger from '@map-colonies/js-logger';
import Cesium, { Cartesian2, Cartographic, sampleTerrainMostDetailed, TerrainProvider } from 'cesium';
import { CesiumTerrainProvider } from 'cesium';
import { Application } from 'express';
import httpStatusCodes from 'http-status-codes';
import { getApp } from '../../../src/app';
import { SERVICES } from '../../../src/common/constants';
import { GetHeightsPointsRequest, GetHeightsPointsResponse } from '../../../src/heights/controllers/heightsController';
import { AdditionalFieldsEnum, PosWithHeight, TerrainTypes } from '../../../src/heights/interfaces';
import mockJsonPoints from '../../../src/heights/MOCKS/mockdata';
import { HeightsRequestSender } from './helpers/requestSender';


describe('heights', function () {
  const mockJsonData = mockJsonPoints as GetHeightsPointsRequest;
  let requestSender: HeightsRequestSender;
  let cesiumTerrainProviderFromUrlSpy: jest.SpyInstance;

  const basicPositionResponse: PosWithHeight = {
    latitude: 0,
    longitude: 0,
    height: 0,
    productType: TerrainTypes.DTM,
    resolutionMeter: 0,
    updateDate: new Date().toISOString()
  } as PosWithHeight;

  beforeAll(async function () {
    cesiumTerrainProviderFromUrlSpy = jest.spyOn(CesiumTerrainProvider, 'fromUrl');
    
    //@ts-ignore
    jest.mock('cesium', () => {
      const originalCesium = jest.requireActual("cesium");

      return {
        // eslint-disable-next-line @typescript-eslint/naming-convention
        __esModule: true,
        ...originalCesium,
        sampleTerrainMostDetailed: jest.fn().mockImplementation(async (provider: CesiumTerrainProvider, positions: Cesium.Cartographic[]): Promise<Cartographic[]> => {
          return Promise.resolve(positions.map(pos => ({...pos, height: 66}) as Cartographic));
        })
      }
    });

    cesiumTerrainProviderFromUrlSpy.mockReturnValue({
      availability: {
        available: true,
        computeMaximumLevelAtPosition: () => {
          return 13;
        }
      },
      tilingScheme: {
        positionToTileXY: () => {
          const xys = [new Cartesian2(1,2), new Cartesian2(3,4), new Cartesian2(5, 6)];
          const randomXy = Math.floor(Math.random() * xys.length);

          return xys[randomXy];
        }
      }
    });

    const app = await getApp({
      override: [
        { token: SERVICES.LOGGER, provider: { useValue: jsLogger({ enabled: false }) } },
      ]
    });
    requestSender = new HeightsRequestSender(app as Application);
  });

  describe('Given valid params', function () {
    describe('Get points height', function () {
      it('should return 200 status code and points heights for basic usage',async function () {
        const response = await requestSender.getPoints(mockJsonData);
        
        expect(response.status).toBe(httpStatusCodes.OK);
        expect(response.body).toHaveProperty("data");
        expect((response.body as GetHeightsPointsResponse).data).toHaveLength(mockJsonData.positions.length);
        
        const getHeightsResProperties = Object.keys(basicPositionResponse);

        for(const position of (response.body as GetHeightsPointsResponse).data) {
          for(const key of getHeightsResProperties) {
            expect(position[key as keyof PosWithHeight]).toBeTruthy();
          }
        }
      });

      it('should return 200 status code and points heights with excluded fields',async function () {
        const response = await requestSender.getPoints({excludeFields: [AdditionalFieldsEnum.PRODUCT_TYPE, AdditionalFieldsEnum.UPDATE_DATE], ...mockJsonData});
        
        expect(response.status).toBe(httpStatusCodes.OK);
        expect(response.body).toHaveProperty("data");
        expect((response.body as GetHeightsPointsResponse).data).toHaveLength(mockJsonData.positions.length);
        
        for(const position of (response.body as GetHeightsPointsResponse).data) {
            expect(position[AdditionalFieldsEnum.PRODUCT_TYPE]).toBeFalsy();
            expect(position[AdditionalFieldsEnum.UPDATE_DATE]).toBeFalsy();
            expect(position[AdditionalFieldsEnum.RESOLUTION_METER]).toBeTruthy();
        }
      });
    });
  });

  // TODO: Protobuf tests.
});
