export const shouldEntry = (
  website: string,
  ignores: RegExp[],
  regexps: RegExp[]
) => {
  if (ignores.length > 0) {
    return !ignores.some((regexp) => regexp.test(website));
  }
  if (regexps.length > 0) {
    return regexps.some((regexp) => regexp.test(website));
  }
  return true;
};
