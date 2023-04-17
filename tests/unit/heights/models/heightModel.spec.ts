import jsLogger from '@map-colonies/js-logger';
import { HeightsManager } from '../../../../src/heights/models/heightsManager';

let heightsManager: HeightsManager;

describe('HeightsManager', () => {
  beforeEach(function () {
    heightsManager = new HeightsManager(jsLogger({ enabled: false }));
  });
  describe('#getHeight', () => {
    it('return height', function () {
      // action
      const height = heightsManager.getHeight();

      // expectation
      expect(height.dem).toBe(1037);
    });
  });
  describe('#getPolygon', () => {
    it('return polygon heights', function () {
      // action
      const heights = heightsManager.getPolygon({ dem: 0 });

      // expectation
      expect(heights).toHaveProperty('dem', 1037);
    });
  });
  describe('#getHeights', () => {
    it('return height list', function () {
      // action
      const heights = heightsManager.getHeights({ dem: 0 });

      // expectation
      expect(heights).toHaveProperty('dem', 1037);
    });
  });
});
