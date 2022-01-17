import { parse, format } from 'url';

export const getCacheKey = (website: string) => {
  const urlObject = parse(website);
  const hash = urlObject.hash || ''; // https://a.com/ => hash: null
  urlObject.hash = '';
  const cacheKey = decodeURIComponent(
    format(urlObject).replace(/\/$/, '') + hash
  );
  return cacheKey;
};
