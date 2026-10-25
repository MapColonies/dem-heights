import jsLogger from '@map-colonies/js-logger';
import httpStatusCodes from 'http-status-codes';
import { CommonErrorCodes, CommonErrors, commonErrorCodesToStatusMap } from '../../../src/common/commonErrors';

describe('CommonErrors', function () {
  const commonErrors = new CommonErrors(jsLogger({ enabled: false }));

  it('UNKNOWN_CATALOG_ITEM is a 400 with the right error code', function () {
    const err = commonErrors.UNKNOWN_CATALOG_ITEM;
    expect(err.status).toBe(httpStatusCodes.BAD_REQUEST);
    expect(err.errorCode).toBe(CommonErrorCodes.UNKNOWN_CATALOG_ITEM);
    expect(commonErrorCodesToStatusMap.get(CommonErrorCodes.UNKNOWN_CATALOG_ITEM)).toBe(httpStatusCodes.BAD_REQUEST);
  });

  it('CATALOG_ITEM_NOT_READY is a 503 with the right error code', function () {
    const err = commonErrors.CATALOG_ITEM_NOT_READY;
    expect(err.status).toBe(httpStatusCodes.SERVICE_UNAVAILABLE);
    expect(err.errorCode).toBe(CommonErrorCodes.CATALOG_ITEM_NOT_READY);
    expect(commonErrorCodesToStatusMap.get(CommonErrorCodes.CATALOG_ITEM_NOT_READY)).toBe(httpStatusCodes.SERVICE_UNAVAILABLE);
  });

  it('POINT_OUTSIDE_CATALOG_ITEM_COVERAGE is a 400 with the right error code', function () {
    const err = commonErrors.POINT_OUTSIDE_CATALOG_ITEM_COVERAGE;
    expect(err.status).toBe(httpStatusCodes.BAD_REQUEST);
    expect(err.errorCode).toBe(CommonErrorCodes.POINT_OUTSIDE_CATALOG_ITEM_COVERAGE);
  });

  it('MISSING_REQUIRED_PROPERTY is a 400 naming the missing property', function () {
    const err = commonErrors.MISSING_REQUIRED_PROPERTY('catalogProductType');
    expect(err.status).toBe(httpStatusCodes.BAD_REQUEST);
    expect(err.errorCode).toBe(CommonErrorCodes.MISSING_REQUIRED_PROPERTY);
    expect(err.message).toContain('catalogProductType');
  });
});
