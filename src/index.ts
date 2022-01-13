import puppeteer from 'puppeteer';
import * as cheerio from 'cheerio';
import { parse, format } from 'url';
import fs from 'fs';
import { getDocumentConstruct, shouldNotEntry } from './utils';
import { join } from 'path';

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
  excludeHref?: RegExp[];
};

const websites: {
  name: string;
  entry: string;
  options: Options;
}[] = [
  // {
  //   name: 'antd',
  //   entry: 'https://ant.design/index-cn',
  //   options: {
  //     mainContainer: '.main-container',
  //     excludesContainers: ['.rc-footer', '.toc-affix'],
  //   },
  // },
  {
    name: 'umi',
    entry: 'https://umijs.org/config',
    options: {
      mainContainer: '.markdown',
      excludesContainers: ['.__dumi-default-layout-toc'],
    },
  },
];

const start = async (entryWebsite: string, name: string, options: Options) => {
  const browser = await puppeteer.launch();
  const page = await browser.newPage();
  await page.setViewport({
    width: 1920,
    height: 1080,
  });
  const cache = new Set();

  let topDoc: Docs | undefined = undefined;

  const getWebsite = async (website: string) => {
    if (
      cache.has(website) ||
      shouldNotEntry(website, options.excludeHref || [])
    ) {
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

    for (let i = 0; i < 1; i++) {
      const href = links.eq(i).attr('href');
      if (href?.startsWith('/') && !href?.startsWith('//') && href !== '/') {
        await getWebsite(format({ ...urlObject, pathname: href }));
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
