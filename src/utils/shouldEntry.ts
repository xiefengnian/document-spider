export const shouldEntry = (website: string, regexps: RegExp[]) => {
  return regexps.some((regexp) => regexp.test(website));
};
