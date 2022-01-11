import puppeteer from 'puppeteer';
import * as cheerio from 'cheerio';
import { parse, format } from 'url';
// import parse5 from 'parse5';
import fs from 'fs';
import rimraf from 'rimraf';
import { getDocumentConstruct } from './utils';

const entryWebsite = 'https://ant.design/docs/spec/introduce-cn';

const start = async (entryWebsite: string) => {
  rimraf.sync('./docs');
  fs.mkdirSync('./docs');
  const browser = await puppeteer.launch();
  const page = await browser.newPage();
  page.setViewport({
    width: 1920,
    height: 1080,
  });

  const cache = new Set();

  const getWebsite = async (website: string) => {
    console.log('goto', website);
    if (cache.has(website)) {
      return;
    }
    cache.add(website);

    const urlObject = parse(website);

    await page.goto(website);

    const content = await page.content();

    const $ = cheerio.load(content);

    const links = $('a');

    const header = $('.markdown');

    const containerSet = new Set();

    const result: any[] = [];

    header.each((i, el) => {
      const currentContainer = header.eq(i);
      if (containerSet.has(currentContainer)) {
        return;
      }
      containerSet.add(currentContainer);
      const construct = getDocumentConstruct(currentContainer);
      result.push(construct);
    });

    fs.writeFileSync(
      `./docs/${urlObject.pathname?.replace(/\//g, '_')}.json`,
      JSON.stringify(result, undefined, 2),
      'utf-8'
    );

    for (let i = 0; i < 1; i++) {
      const href = links.eq(i).attr('href');
      if (href?.startsWith('/') && !href?.startsWith('//') && href !== '/') {
        console.log(href);
        await getWebsite(format({ ...urlObject, pathname: href }));
      }
    }
  };
  await getWebsite(entryWebsite);
  browser.close();
};
start(entryWebsite);
