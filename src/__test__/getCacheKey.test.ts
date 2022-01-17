import { getCacheKey } from '../utils/getCacheKey';

describe('cache key should get correctly', () => {
  it('normal', () => {
    expect(getCacheKey('https://a.com/#%E5%93%88%E5%93%88')).toEqual(
      'https://a.com#哈哈'
    );
    expect(getCacheKey('https://a.com#%E5%93%88%E5%93%88')).toEqual(
      'https://a.com#哈哈'
    );
    expect(getCacheKey('https://a.com/')).toEqual('https://a.com');
    expect(getCacheKey('https://a.com/#哈哈')).toEqual('https://a.com#哈哈');
    expect(getCacheKey('https://ant.design/docs/resources%23Articles')).toEqual(
      'https://ant.design/docs/resources#Articles'
    );
  });
});
