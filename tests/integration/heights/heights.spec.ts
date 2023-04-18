import jsLogger from '@map-colonies/js-logger';
import { trace } from '@opentelemetry/api';
import httpStatusCodes from 'http-status-codes';
import { getApp } from '../../../src/app';
import { SERVICES } from '../../../src/common/constants';
import { IHeightModel } from '../../../src/heights/models/heightsManager';
import { HeightsRequestSender } from './helpers/requestSender';

describe('heights', function () {
  let requestSender: HeightsRequestSender;
  beforeEach(function () {
    const app = getApp({
      override: [
        { token: SERVICES.LOGGER, provider: { useValue: jsLogger({ enabled: false }) } },
        { token: SERVICES.TRACER, provider: { useValue: trace.getTracer('testTracer') } },
      ],
      useChild: true,
    });
    requestSender = new HeightsRequestSender(app);
  });

  describe('Happy Path', function () {
    it('should return 200 status code and points heights', async function () {
      const response = await requestSender.getPoints();

      expect(response.status).toBe(httpStatusCodes.OK);
    });
    it('should return 200 status code and path heights', async function () {
      const response = await requestSender.getPath();

      expect(response.status).toBe(httpStatusCodes.OK);
    });
    it('should return 200 status code and plygon heights', async function () {
      const response = await requestSender.getPolygon();

      expect(response.status).toBe(httpStatusCodes.OK);
    });
    it('should return 200 status code and geojson heights', async function () {
      const response = await requestSender.getHeights();

      expect(response.status).toBe(httpStatusCodes.OK);
    });
    it('should return 200 status code and the heights', async function () {
      const response = await requestSender.getHeight();

      expect(response.status).toBe(httpStatusCodes.OK);

      const heights = response.body as IHeightModel;
      //expect(response).toSatisfyApiSpec();
      expect(heights.dem).toBe(1037);
    });
  });
  describe('Bad Path', function () {
    // All requests with status code of 400
  });
  describe('Sad Path', function () {
    // All requests with status code 4XX-5XX
  });
});
