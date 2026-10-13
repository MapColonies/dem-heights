import { generateChecksum, isSame, syncRetryDelay } from '../../../src/heights/utilities';

describe('utilities', () => {
  describe('generateChecksum', () => {
    it('is deterministic for the same input', () => {
      expect(generateChecksum('abc')).toEqual(generateChecksum('abc'));
    });
    it('differs for different input', () => {
      expect(generateChecksum('abc')).not.toEqual(generateChecksum('abd'));
    });
  });

  describe('isSame', () => {
    it('returns true for deeply equal objects', () => {
      expect(isSame({ a: 1, b: [2, 3] }, { a: 1, b: [2, 3] })).toBe(true);
    });
    it('returns false for different objects', () => {
      expect(isSame({ a: 1 }, { a: 2 })).toBe(false);
    });
  });

  describe('syncRetryDelay', () => {
    it('doubles the delay with each consecutive failure', () => {
      expect([1, 2, 3, 4].map((failures) => syncRetryDelay(failures, 600000))).toEqual([5000, 10000, 20000, 40000]);
    });
    it('never exceeds the sync interval', () => {
      expect(syncRetryDelay(20, 600000)).toBe(600000);
    });
  });
});
