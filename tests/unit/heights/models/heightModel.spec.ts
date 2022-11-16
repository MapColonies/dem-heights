import jsLogger from '@map-colonies/js-logger';
import { HeightsManager } from '../../../../src/heights/models/heightsManager';

let heightsManager: HeightsManager;

describe('HeightsManager', () => {
  beforeEach(function () {
    heightsManager = new HeightsManager(jsLogger({ enabled: false }));
  });
  describe('#getHeights', () => {
    it('return heights', function () {
      // action
      const height = heightsManager.getHeights();

      // expectation
      expect(height.dem).toBe(1037);
    });
  });
  describe('#getHeightsList', () => {
    it('return heights list', function () {
      // action
      const heights = heightsManager.getHeightsList({ dem: 0 });

      // expectation
      expect(heights).toHaveProperty('dem', 1037);
    });
  });
});
