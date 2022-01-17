import { getDocumentConstruct } from '../utils/getDocumentConstruct';
import { readFileSync } from 'fs';
import { join } from 'path';
import * as cheerio from 'cheerio';

describe('document parse should correct', () => {
  it('antd button page: https://ant.design/docs/spec/introduce-cn', () => {
    const html = readFileSync(join(__dirname, './fixture/antd_intro.html'));
    expect(
      getDocumentConstruct(cheerio.load(html)('.main-container'), '/', 'antd')
    ).toEqual(
      JSON.parse(
        readFileSync(join(__dirname, './fixture/antd_intro.json'), 'utf-8')
      )
    );
  });
});
