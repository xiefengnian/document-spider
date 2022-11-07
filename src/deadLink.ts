import { webkit, Page } from 'playwright';
import got from 'got';

let g_page: Page | null = null;

const deadLinkList: {
  url: string;
  text: string | null;
}[] = [];

const urlMap = new Map();
/**
 * 生成 Page 对象
 */
const initPage = async () => {
  const browser = await webkit.launch(); // Or 'firefox' or 'webkit'.
  g_page = await browser.newPage();
  return g_page;
};

const findALlLink = async (pageUrl: string) => {
  const page = await initPage();
  await page.goto(pageUrl);

  const linkList = await page.evaluate(() => {
    return Array.from(document.body.querySelectorAll('a')).map((e) => {
      return { url: e.href, text: e.textContent };
    });
  });
  return linkList;
};

const checkIsDeadLink = async (link: string) => {
  const res = await got.get(link);
  return res.statusCode !== 200;
};

const check = async (url: string) => {
  if (urlMap.has(url)) return;
  urlMap.set(url, true);
  console.log(url);
  const list = await findALlLink(url);
  for await (const urlItem of list) {
    const isDead = await checkIsDeadLink(urlItem.url);
    if (isDead) {
      deadLinkList.push(urlItem);
    } else if (
      urlItem.url.includes(url) &&
      urlItem.url !== url &&
      urlItem.url.includes('https')
    ) {
      await check(urlItem.url);
    }
  }
};

(async () => {
  await check('https://antchain.antgroup.com/');
})();
