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
};

type Options = {
  mainContainer: string;
  excludesContainers?: string[];
  urlFilters?: RegExp[];
  urlIgnores?: RegExp[];
};

const websites: {
  name: string;
  entry: string;
  options: Options;
}[] = [
  {
    name: 'ant-design',
    entry: 'https://ant.design/components/button-cn/',
    options: {
      mainContainer: '.main-container',
      excludesContainers: ['.rc-footer', '.toc-affix'],
      urlFilters: [/-cn/, /changelog/],
    },
  },
  {
    name: 'umi',
    entry: 'https://umijs.org/zh-CN',
    options: {
      mainContainer: '.markdown',
      excludesContainers: ['.__dumi-default-layout-toc'],
      urlFilters: [/zh-CN/],
    },
  },
  {
    name: 'procomponents',
    entry: 'https://procomponents.ant.design/components/card',
    options: {
      mainContainer: '.markdown',
      excludesContainers: ['.__dumi-default-layout-toc'],
      urlIgnores: [/en-US/, /changelog/],
    },
  },
  {
    name: 'dumi',
    entry: 'https://d.umijs.org',
    options: {
      mainContainer: '.markdown',
      excludesContainers: ['.__dumi-default-layout-toc'],
      urlFilters: [/zh-CN/],
    },
  },
  {
    name: 'ant-design-pro',
    entry: 'https://pro.ant.design',
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

  let topDoc: Docs = {
    toc: [],
    title: name,
    url: entryWebsite,
    content: '',
  };

  const getWebsite = async (website: string) => {
    // https://a.com/#中文 和 https://a.com#中文 应该视为相同的网站
    const cacheKey = getCacheKey(website);
    if (
      cache.has(cacheKey) ||
      !shouldEntry(website, options.urlIgnores || [], options.urlFilters || [])
    ) {
      console.log('已经缓存或不需要，忽略：', cacheKey);
      return;
    } else {
      console.log('into', cacheKey);
    }
    cache.add(cacheKey);

    const urlObject = parse(cacheKey);

    let content = '';
    try {
      await page.goto(cacheKey);
    } catch (error) {
      console.log('lose ', cacheKey);
      console.log(error);
      return;
    }
    content = await page.content();

    const $ = cheerio.load(content);

    const mainContainerClassName = options.mainContainer;

    const mainContainer = $(
      `${mainContainerClassName}`
    ) as cheerio.Cheerio<cheerio.Element>;
    const construct = getDocumentConstruct(mainContainer, cacheKey, name);

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
      url: cacheKey,
      content: '',
    };

    if (!topDoc) {
      topDoc = docs;
    } else {
      // 去除死链
      if (!docs.content && docs.toc.length === 0) {
        // do nothing
      } else if (docs?.url) {
        topDoc.toc.push(docs);
      }
    }

    // 相同链接hash不同的，优先跳转，避免页面重复 reload
    const sortedLinks = links
      .map((i) => links.eq(i).attr('href'))
      .toArray()
      .sort();

    for await (const href of sortedLinks) {
      if (
        href?.startsWith('/') &&
        !href?.startsWith('//') &&
        href !== '/' &&
        !href.includes('#')
      ) {
        await getWebsite(format({ ...urlObject, pathname: href, hash: '' })); // 又是 href 后是带 hash 的，把原来的 hash 注销一下
      }
    }
  };
  await getWebsite(entryWebsite);
  browser.close();
  return topDoc;
};

const main = async () => {
  const result = [];

  // create docs dir
  const docsDir = join(__dirname, './docs');
  if (!fs.existsSync(docsDir)) {
    fs.mkdirSync(docsDir, { recursive: true });
  }

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
