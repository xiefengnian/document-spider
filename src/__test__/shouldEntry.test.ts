import { shouldEntry } from '../utils/shouldEntry';

describe('should entry work fine.', () => {
  it('antd site', () => {
    const regexps: RegExp[] = [/-cn/];
    const ignores: RegExp[] = [/en/];
    expect(shouldEntry('https://ant.design/', [], regexps)).toBeFalsy();
    expect(
      shouldEntry('https://ant.design/index-cn', [], regexps)
    ).toBeTruthy();
    expect(shouldEntry('https://ant.design/en/', ignores, regexps)).toBeFalsy();
  });
  it('antd pro', () => {
    const regexps: RegExp[] = [];
    const ignores: RegExp[] = [/en-US/];
    expect(
      shouldEntry(
        'https://procomponents.ant.design/changelog',
        ignores,
        regexps
      )
    ).toBeTruthy();
    expect(
      shouldEntry(
        'https://procomponents.ant.design/en-US/changelog',
        ignores,
        regexps
      )
    ).toBeFalsy();
  });
  it('default dumi site', () => {
    expect(shouldEntry('https://umijs.org/zh-CN', [], [/zh-CN/])).toBeTruthy();
  });
});
