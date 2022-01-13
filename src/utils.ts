import * as cheerio from 'cheerio';
import { cloneDeep } from 'lodash';
import { Tabletojson } from 'tabletojson';

type SerializationHtml = {
  tagName: string;
  text: string;
  children: SerializationHtml[];
  content?: string;
  title?: string;
  url: string;
  className: string;
};

type DocConstruct = {
  content: string;
  toc: DocConstruct[];
  title: string;
  url: string;
};

type DocConstructWithTagName = {
  content: string;
  toc: DocConstruct[];
  title: string;
  tagName: string;
  url: string;
  className: string;
  links: { title: string; url: string }[];
};

type DocConstructWithTag = {
  tag: 'TEXT' | 'API' | 'DEMO';
} & Omit<DocConstructWithTagName, 'tagName'>;

/**
 * TODO：已知BUG
 * <h1>
 *  <section>
 *    <h2>
 *  </section>
 * </h1>
 * 提取错误
 *
 * ref: https://ant.design/components/button-cn/# 何时使用
 */

export const getDocumentConstruct = (
  root: cheerio.Cheerio<cheerio.Element>,
  entryUrl: string,
  /** website name */
  name: string
): DocConstructWithTag[] => {
  // 提前处理 table

  const stringifyTable = () => {
    const tables = root.find('table');

    tables.each((i) => {
      const table = tables.eq(i);
      table.replaceWith(
        `
        <div class="table_placeholder">${JSON.stringify(
          Tabletojson.convert(table.parent().html() || '')[0][0]
        )}</div>`
      );
    });
  };

  stringifyTable();

  const getHtmlConstruct = (
    ele: cheerio.Cheerio<cheerio.Element>,
    construct: SerializationHtml
  ) => {
    const children = ele.children();
    children?.each((i) => {
      const child = children.eq(i);
      const { type, name: tagName } = child[0];
      const id = child.attr('id');
      const result = {
        tagName: tagName,
        text: child.text(),
        children: [],
        url: id ? entryUrl + '#' + id : '',
        className: child.attr('class') || '',
      };
      if (type === 'text') {
        construct.text += (child as any)[0].data;
      } else {
        construct.children.push(getHtmlConstruct(child, result));
      }
    });
    return construct;
  };

  // 抽取 html 结构
  const result = getHtmlConstruct(root, {
    text: root.text(),
    tagName: root[0]?.name,
    children: [],
    url: entryUrl,
    className: root.attr('class') || '',
  });

  const result2: SerializationHtml[] = [];

  const isTitle = (tagName: string) => /^h[1-6]$/.test(tagName);

  const getRequiredNode = (current: SerializationHtml) => {
    const { children } = current;

    // 不能直接抽取 code 标签，因为在 antd 中 demo 没有层级关系
    /**
     * <section class="code-box">
     *  <div class="code-box-title"><a href="#components-button-demo-icon">图标按钮</a></div>
     *  <section class="highlight-wrapper"></section>
     * </section>
     */

    if (name === 'antd' && current.className === 'code-box') {
      const url = current.url;
      let title = '';
      let content = '';
      const getChildren = (node: SerializationHtml) => {
        if (node.className === 'code-box-title') {
          title = node.text || '';
          return;
        }
        if (node.tagName === 'code') {
          content += node.text;
          return;
        }
        node.children?.forEach((child) => {
          getChildren(child);
        });
      };
      getChildren(current);
      result2.push({
        ...current,
        url,
        content,
        title,
        children: [],
        tagName: 'code', // 对代码标签归一化
      });
      return;
    }

    if (name === 'umi' && current.className === '__dumi-default-code-block') {
      result2.push({
        ...current,
        tagName: 'code', // 对代码标签归一化
        children: [],
      });
      return;
    }

    if (children.find(({ tagName }) => isTitle(tagName))) {
      for (let i = 0; i < children.length; i++) {
        const child = children[i];
        if (isTitle(child.tagName)) {
          let content = '';
          for (let j = i + 1; j < children.length; j++) {
            const nextChild = children[j];
            console.log(nextChild.tagName, nextChild.className);
            if (isTitle(nextChild.tagName)) {
              i = j - 1;
              break;
            }
            if (nextChild.className === '__dumi-default-code-block') {
              getRequiredNode(nextChild);
              continue;
            }
            content += nextChild.text;
          }
          child.content = content;
          child.children = [];
          result2.push(child);
        }
      }
    } else {
      children.forEach((child) => {
        getRequiredNode(child);
      });
    }
  };

  // 抽取必须的节点，其余省略
  getRequiredNode(cloneDeep(result));

  // 转化一轮格式
  const result3: DocConstructWithTagName[] = result2.map(
    ({ text, tagName, content, url, className, title }) => {
      if (isTitle(tagName)) {
        return {
          content: content || '',
          tagName,
          title: text,
          toc: [],
          tag: undefined,
          url,
          className,
          links: [],
        };
      } else {
        return {
          content: text,
          tagName,
          title: title || '',
          toc: [],
          tag: undefined,
          url,
          className,
          links: [],
        };
      }
    }
  );

  const result4: DocConstructWithTag[] = [];

  // 最后整理数据结构
  for (let i = 0; i < result3.length; i++) {
    const header: DocConstructWithTag & { tagName: string } = {
      ...result3[i],
      tag:
        result3[i].tagName === 'code'
          ? 'DEMO'
          : /API/.test(result3[i].title)
          ? 'API'
          : 'TEXT',
    };

    if (header.tagName === 'h1') {
      result4.push(header);
    } else {
      if (header.tagName === 'code') {
        if (i > 0) {
          let doneInsert = false;
          for (let j = i - 1; j > -1; j--) {
            const prevHeader = result3[j];
            if (isTitle(prevHeader.tagName)) {
              prevHeader.toc.push(header);
              doneInsert = true;
              break;
            }
          }
          if (!doneInsert) {
            result4.push(header);
          }
        } else {
          result4.push(header);
        }
      } else {
        const tagNum = parseInt(header.tagName[1]);
        if (i > 0) {
          let doneInsert = false;
          for (let j = i - 1; j > -1; j--) {
            const prevHeader = result3[j];
            if (parseInt(prevHeader.tagName[1]) < tagNum) {
              prevHeader.toc.push(header);
              doneInsert = true;
              break;
            }
          }
          if (!doneInsert) {
            result4.push(header);
          }
        } else {
          result4.push(header);
        }
      }
    }
  }
  return result4;
};

export const shouldNotEntry = (website: string, regexps: RegExp[]) => {
  return regexps.some((regexp) => regexp.test(website));
};
