import { container } from 'tsyringe';
import { HeightsManager } from '../../../../src/heights/models/heightsManager';
import mockJsonPoints, { positionsOutsideOfProviders, emptyPositionsRequest } from '../../../../src/heights/MOCKS/mockData';
import { GetHeightsPointsRequest } from '../../../../src/heights/controllers/heightsController';
import { PosWithHeight, TerrainTypes } from '../../../../src/heights/interfaces';
import { registerTestValues } from '../../../configurations/testContainerConfig';

describe('Get Heights model', function () {
  const mockJsonData = mockJsonPoints as GetHeightsPointsRequest;
  const mockJsonDataOutOfBounds = positionsOutsideOfProviders as GetHeightsPointsRequest;

  let heightsManager: HeightsManager;

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
    it('Should return positions with height and productId', async function () {
      const result = await heightsManager.getPoints(mockJsonData.positions, TerrainTypes.MIXED);

      expect(result).toHaveLength(mockJsonData.positions.length);
      for (const position of result) {
        expect(position.height).toBe(100);
        expect(position.productId).toBeDefined();
      }
    });

    it('Should return null heights and no productId when no provider matches the product type', async function () {
      const result = await heightsManager.getPoints(mockJsonData.positions, TerrainTypes.DSM);

      expect(result).toHaveLength(mockJsonData.positions.length);
      for (const position of result) {
        expect(position.height).toBeNull();
        expect(position.productId).toBeUndefined();
      }
    });

    it('Should return height only for the positions inside a provider footprint', async function () {
      const result = await heightsManager.getPoints(mockJsonDataOutOfBounds.positions, TerrainTypes.MIXED);

      expect(result).toHaveLength(mockJsonDataOutOfBounds.positions.length);
      for (const position of result) {
        expect(position.longitude).toBeDefined();
        expect(position.latitude).toBeDefined();

        const isNullHeight = (position.height as number | null) === null;
        expect(typeof position.productId === 'undefined').toEqual(isNullHeight);
      }
    });
  });

  describe('Given invalid params', function () {
    it('Should return empty array for empty positions', async function () {
      await expect(heightsManager.getPoints((emptyPositionsRequest as unknown as GetHeightsPointsRequest).positions, TerrainTypes.MIXED)).resolves.toEqual([]);
    });
  });
});
