import puppeteer from 'puppeteer';
import * as cheerio from 'cheerio';
import { parse, format } from 'url';
import fs from 'fs';
import { getDocumentConstruct } from './utils/getDocumentConstruct';
import { shouldEntry } from './utils/shouldEntry';
import { join } from 'path';
import { getCacheKey } from './utils/getCacheKey';

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

type Options = {
  mainContainer: string;
  excludesContainers?: string[];
  urlFilters?: RegExp[];
};

const websites: {
  name: string;
  entry: string;
  options: Options;
}[] = [
  // {
  //   name: 'antd',
  //   entry: 'https://ant.design/components/button-cn/',
  //   options: {
  //     mainContainer: '.main-container',
  //     excludesContainers: ['.rc-footer', '.toc-affix'],
  //     urlFilters: [/-cn/],
  //   },
  // },
  {
    name: 'umi',
    entry: 'https://umijs.org/zh-CN',
    options: {
      mainContainer: '.markdown',
      excludesContainers: ['.__dumi-default-layout-toc'],
      urlFilters: [/zh-CN/],
    },
  },
];

const start = async (entryWebsite: string, name: string, options: Options) => {
  const browser = await puppeteer.launch({});
  const page = await browser.newPage();
  await page.setDefaultNavigationTimeout(0);
  await page.setViewport({
    width: 1920,
    height: 1080,
  });
  const cache = new Set();

  let topDoc: Docs | undefined = undefined;

  const getWebsite = async (website: string) => {
    // https://a.com/#中文 和 https://a.com#中文 应该视为相同的网站
    const cacheKey = getCacheKey(website);
    if (
      cache.has(cacheKey) ||
      !shouldEntry(website, options.urlFilters || [])
    ) {
      console.log('! throw', cacheKey);
      return;
    } else {
      console.log('into', cacheKey);
    }
    cache.add(cacheKey);

    const urlObject = parse(cacheKey);

    let content = '';
    try {
      await page.goto(website);
    } catch (error) {
      console.log('lose ', website);
      console.log(error);
      return;
    }
    content = await page.content();

    const $ = cheerio.load(content);

    const mainContainerClassName = options.mainContainer;

    const mainContainer = $(
      `${mainContainerClassName}`
    ) as cheerio.Cheerio<cheerio.Element>;
    const construct = getDocumentConstruct(mainContainer, website, name);

    // 删除多余 dom
    options.excludesContainers?.forEach((containerSelector) => {
      $(containerSelector).remove();
    });

    const links = $('a');

    const docs: Docs = {
      // eslint-disable-next-line @typescript-eslint/ban-ts-comment
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

    // 相同链接hash不同的，优先跳转，避免页面重复 reload
    const sortedLinks = links
      .map((i) => links.eq(i).attr('href'))
      .toArray()
      .sort();

    for await (const href of sortedLinks) {
      if (href?.startsWith('/') && !href?.startsWith('//') && href !== '/') {
        await getWebsite(format({ ...urlObject, pathname: href, hash: '' }));
      }
    }
  };
  await getWebsite(entryWebsite);
  browser.close();
  return topDoc;
};

const main = async () => {
  const result = [];
  for await (const aWebsite of websites) {
    result.push(await start(aWebsite.entry, aWebsite.name, aWebsite.options));
  }

  fs.writeFileSync(
    join(__dirname, '../docs/output.json'),
    JSON.stringify(result, undefined, 2),
    'utf-8'
  );
};

main();
