import puppeteer from 'puppeteer';
import * as cheerio from 'cheerio';
import { parse, format } from 'url';
// import parse5 from 'parse5';
import fs from 'fs';
import rimraf from 'rimraf';
import { getDocumentConstruct } from './utils';

export type Docs = {
  // 页面标题
  title: string;
  // 页面路径
  url: string;
  // 子级的数据
  toc: Docs[];
  // 文本内容
  content: string;
  // 页面中的超链接
  links: { title: string; url: string }[];
};

const entryWebsite = 'https://ant.design/docs/react/introduce-cn';

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

  let topDoc: Docs | undefined = undefined;

  const getWebsite = async (website: string) => {
    if (cache.has(website) || !/-cn/.test(website)) {
      return;
    }
    console.log(website);

    cache.add(website);

    const urlObject = parse(website);
    try {
      await page.goto(website);
    } catch (error) {
      console.log('lose ', website);
      console.log(error);
      return;
    }

    const content = await page.content();

    const $ = cheerio.load(content);

    const header = $('.main-container');
    const construct = getDocumentConstruct(header, website);

    // 删除多余 dom
    $('.rc-footer').remove();
    $('.toc-affix').remove();

    const links = $('a');

    const docs: Docs = {
      // @ts-ignore
      toc: construct,
      title: $('title').text(),
      url: website,
      content: '',
      links: [
        ...links.map((i) => ({
          title: links.eq(i).text(),
          url: links.eq(i).attr('href') || '',
        })),
      ],
    };

    if (!topDoc) {
      topDoc = docs;
    } else {
      topDoc.toc.push(docs);
    }

    for (let i = 0; i < 1; i++) {
      const href = links.eq(i).attr('href');
      if (href?.startsWith('/') && !href?.startsWith('//') && href !== '/') {
        await getWebsite(format({ ...urlObject, pathname: href }));
      }
    }
  };
  try {
    await getWebsite(entryWebsite);
  } catch (error) {
    throw error;
  }

  fs.writeFileSync(
    './antd.json',
    JSON.stringify(topDoc, undefined, 2),
    'utf-8'
  );
  browser.close();
};
start(entryWebsite);
