import { GeoJSON } from 'geojson';
import jsLogger from '@map-colonies/js-logger';
import { HeightsManager } from '../../../../src/heights/models/heightsManager';

const POLYGON: GeoJSON = {
  "type": "FeatureCollection",
  "features": [
    {
      "type": "Feature",
      "properties": {},
      "geometry": {
        "coordinates": [
          [
            [
              35.02870132321911,
              32.786567320978435
            ],
            [
              35.02870132321911,
              32.63575704168383
            ],
            [
              35.2111957895942,
              32.63575704168383
            ],
            [
              35.2111957895942,
              32.786567320978435
            ],
            [
              35.02870132321911,
              32.786567320978435
            ]
          ]
        ],
        "type": "Polygon"
      }
    }
  ]
};

let heightsManager: HeightsManager;

describe('HeightsManager', () => {
  beforeEach(function () {
    heightsManager = new HeightsManager(jsLogger({ enabled: false }));
  });
  describe('#getHeight', () => {
    it('return height', function () {
      // action
      const height = heightsManager.getHeight({longitude: '35.034', latitude: '32.691'});

      // expectation
      expect(height.dem).toBe(1037);
    });
  });
  describe('#getPolygon', () => {
    it('return polygon heights', function () {
      // action
      const heights = heightsManager.getPolygon(POLYGON);

      // expectation
      expect(heights).toHaveProperty('dem', 1037);
    });
  });
  describe('#getHeights', () => {
    it('return height list', function () {
      // action
      const heights = heightsManager.getHeights(POLYGON);

      // expectation
      expect(heights).toHaveProperty('dem', 1037);
    });
  });
});
