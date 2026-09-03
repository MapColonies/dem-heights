import { generateChecksum, isSame } from '../../../src/heights/utilities';

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
});
