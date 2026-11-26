import TileCache from '../../../../src/heights/models/tileCache';

describe('TileCache', () => {
  it('returns what was stored and nothing for an unknown key', () => {
    const cache = new TileCache(100);
    cache.set('a', [1, 2], 10);

    expect(cache.get('a')).toEqual([1, 2]);
    expect(cache.get('b')).toBeUndefined();
  });

  it('evicts the least recently used tile once over budget', () => {
    const cache = new TileCache(30);
    cache.set('a', [1], 10);
    cache.set('b', [2], 10);
    cache.set('c', [3], 10);
    cache.get('a');

    cache.set('d', [4], 10);

    expect(cache.get('b')).toBeUndefined();
    expect(cache.get('a')).toEqual([1]);
    expect(cache.get('c')).toEqual([3]);
    expect(cache.get('d')).toEqual([4]);
    expect(cache.size).toBe(30);
  });

  it('evicts as many tiles as a large one needs', () => {
    const cache = new TileCache(30);
    cache.set('a', [1], 10);
    cache.set('b', [2], 10);

    cache.set('c', [3], 25);

    expect(cache.get('a')).toBeUndefined();
    expect(cache.get('b')).toBeUndefined();
    expect(cache.get('c')).toEqual([3]);
    expect(cache.size).toBe(25);
  });

  it('skips a tile larger than the whole budget and keeps the rest', () => {
    const cache = new TileCache(30);
    cache.set('a', [1], 10);

    cache.set('big', [2], 31);

    expect(cache.get('big')).toBeUndefined();
    expect(cache.get('a')).toEqual([1]);
  });

  it('counts a replaced tile once', () => {
    const cache = new TileCache(30);
    cache.set('a', [1], 10);

    cache.set('a', [2], 20);

    expect(cache.get('a')).toEqual([2]);
    expect(cache.size).toBe(20);
  });
});
