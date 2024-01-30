import { container } from 'tsyringe';
import { Cartesian2, Cartographic, CesiumTerrainProvider } from 'cesium';
import { HeightsManager } from '../../../../src/heights/models/heightsManager';
import mockJsonPoints, {
  moreThen150RequestsPositions,
  positionsOutsideOfProviders,
  emptyPositionsRequest,
} from '../../../../src/heights/MOCKS/mockData';
import { GetHeightsPointsRequest } from '../../../../src/heights/controllers/heightsController';
import { PosWithHeight, TerrainTypes } from '../../../../src/heights/interfaces';
import { registerTestValues } from '../../../configurations/testContainerConfig';
import { CommonErrorCodes } from '../../../../src/common/commonErrors';

describe('Get Heights model', function () {
  const mockJsonData = mockJsonPoints as GetHeightsPointsRequest;
  const mockJsonDataLowDensity = moreThen150RequestsPositions as GetHeightsPointsRequest;
  const mockJsonDataOutOfBounds = positionsOutsideOfProviders as GetHeightsPointsRequest;

  let heightsManager: HeightsManager;
  let cesiumTerrainProviderFromUrlSpy: jest.SpyInstance;

  const basicPositionResponse: PosWithHeight = {
    latitude: 0,
    longitude: 0,
    height: 0,
    productId: 'dummy_product_id',
  } as PosWithHeight;

  beforeAll(function () {
    // convert mock json data to degrees.

    mockJsonData.positions = mockJsonData.positions.map((pos) => {
      return Cartographic.fromDegrees(pos.longitude, pos.latitude);
    });

    mockJsonDataLowDensity.positions = mockJsonDataLowDensity.positions.map((pos) => {
      return Cartographic.fromDegrees(pos.longitude, pos.latitude);
    });

    mockJsonDataOutOfBounds.positions = mockJsonDataOutOfBounds.positions.map((pos) => {
      return Cartographic.fromDegrees(pos.longitude, pos.latitude);
    });

    cesiumTerrainProviderFromUrlSpy = jest.spyOn(CesiumTerrainProvider, 'fromUrl');

    cesiumTerrainProviderFromUrlSpy.mockReturnValue({
      availability: {
        available: true,
        computeMaximumLevelAtPosition: () => {
          return 13;
        },
      },
      tilingScheme: {
        positionToTileXY: () => {
          // Always a maximum of 3 "Tile requests"

          const xys = [new Cartesian2(1, 2), new Cartesian2(3, 4), new Cartesian2(5, 6)];
          const randomXy = Math.floor(Math.random() * xys.length);

          return xys[randomXy];
        },
      },
    });
  });

  beforeEach(async function () {
    await registerTestValues();

    heightsManager = container.resolve(HeightsManager);
  });

  afterEach(() => {
    container.reset();
    container.clearInstances();
    jest.clearAllMocks();
  });

  describe('Given valid parameters', function () {
    it('Should return positions with height and extra metadata fields', async function () {
      const result = await heightsManager.getPoints(mockJsonData.positions, TerrainTypes.MIXED);

      expect(result).toHaveLength(mockJsonData.positions.length);

      const getHeightsResProperties = Object.keys(basicPositionResponse);

      for (const position of result) {
        for (const key of getHeightsResProperties) {
          expect(position[key as keyof PosWithHeight]).toBeTruthy();
        }
      }
    });

    it('Should return positions with height and productId', async function () {
      const result = await heightsManager.getPoints(mockJsonData.positions, TerrainTypes.MIXED);

      expect(result).toHaveLength(mockJsonData.positions.length);

      for (const position of result) {
        expect(position['productId']).toBeDefined();
      }
    });

    it('Should return the positions with null heights and no fields if no provider match for the request', async function () {
      const nonExistingTerrainType = TerrainTypes.DSM;
      const result = await heightsManager.getPoints(mockJsonData.positions, nonExistingTerrainType);

      expect(result).toHaveLength(mockJsonData.positions.length);

      for (const position of result) {
        expect(position.height).toBeNull();
        expect(position['productId']).toBeUndefined();
      }
    });

    it('Should be able to return height and data for only a part of the positions', async function () {
      const result = await heightsManager.getPoints(mockJsonDataOutOfBounds.positions, TerrainTypes.MIXED);

      expect(result).toHaveLength(mockJsonDataOutOfBounds.positions.length);

      for (const position of result) {
        expect(position['latitude'] && position['longitude']).toBeDefined();

        const isNullHeight = (position.height as number | null) === null;

        expect(typeof position['productId'] === 'undefined').toEqual(isNullHeight);
      }
    });
  });

  describe('Given invalid params', function () {
    beforeAll(function () {
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
            // Making sure there is no tiles overlapping for any position. so that each position is a "request". (Assuming unique positions)
            return new Cartesian2(position.latitude, position.longitude);
          },
        },
      });
    });

    it.skip('Should throw dansity too low error for 150+ points (As configured)', async function () {
      await expect(heightsManager.getPoints(mockJsonDataLowDensity.positions, TerrainTypes.MIXED)).rejects.toHaveProperty(
        'errorCode',
        CommonErrorCodes.POINTS_DENSITY_TOO_LOW_ERROR
      );
    });

    it('Should return empty array', async function () {
      await expect(heightsManager.getPoints(emptyPositionsRequest.positions, TerrainTypes.MIXED)).resolves.toEqual([]);
    });
  });
});
