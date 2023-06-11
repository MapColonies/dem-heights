/* eslint-disable @typescript-eslint/no-unsafe-return */
/* eslint-disable @typescript-eslint/no-unsafe-assignment */

import Cesium, { Cartographic, CesiumTerrainProvider } from 'cesium';
import 'reflect-metadata';

jest.mock('cesium', () => {
  const originalCesium = jest.requireActual('cesium');

  return {
    // eslint-disable-next-line @typescript-eslint/naming-convention
    __esModule: true,
    ...originalCesium,
    sampleTerrainMostDetailed: jest
      .fn()
      .mockImplementation(async (provider: CesiumTerrainProvider, positions: Cesium.Cartographic[]): Promise<Cartographic[]> => {
        return Promise.resolve(positions.map((pos) => ({ ...pos, height: 66 } as Cartographic)));
      }),
  };
});
