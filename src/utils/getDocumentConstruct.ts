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

const TABLE_PLACEHOLDER_CLASS_NAME = 'DS__internal_table_placeholder';

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
        <div class="${TABLE_PLACEHOLDER_CLASS_NAME}">${JSON.stringify(
          Tabletojson.convert(table.parent().html() || '')[0]
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
      const htmlConstruct = {
        tagName: tagName,
        text: child.text(),
        children: [],
        url: id ? entryUrl + '#' + id : '',
        className: child.attr('class') || '',
      };
      if (type === 'text') {
        construct.text += (child as any)[0].data;
      } else {
        construct.children.push(getHtmlConstruct(child, htmlConstruct));
      }
    });
    return construct;
  };

  // 抽取 html 结构
  const htmlConstruct = getHtmlConstruct(root, {
    text: root.text(),
    tagName: root[0]?.name,
    children: [],
    url: entryUrl,
    className: root.attr('class') || '',
  });

  const serializedHtml: SerializationHtml[] = [];

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

    // TODO: 已知 bug：antd 中同级的 pre.code 无法独立抽取
    if (name === 'antd' && current.className === 'code-box') {
      const url = current.url;
      let title = '';
      let content2 = '';
      const getChildren = (node: SerializationHtml) => {
        if (node.className === 'code-box-title') {
          title = node.text || '';
          return;
        }
        if (node.tagName === 'code') {
          content2 += node.text;
          return;
        }
        node.children?.forEach((child2) => {
          getChildren(child2);
        });
      };
      getChildren(current);
      serializedHtml.push({
        ...current,
        url,
        content: content2,
        title,
        children: [],
        tagName: 'code', // 对代码标签归一化
      });
      return;
    }

    if (children.find(({ tagName }) => isTitle(tagName))) {
      for (let i = 0; i < children.length; i++) {
        const child = children[i];
        if (isTitle(child.tagName)) {
          let content = '';
          const appendToEnd: SerializationHtml[] = [];
          for (let j = i + 1; j < children.length; j++) {
            const nextChild = children[j];
            if (isTitle(nextChild.tagName)) {
              i = j - 1;
              break;
            }
            if (
              // dumi 不是使用 <code /> 作为容器的，也要兼容常规的 code
              nextChild.className === '__dumi-default-code-block'
            ) {
              appendToEnd.push({ ...nextChild, tagName: 'code', children: [] });
              // getRequiredNode(nextChild);
              continue;
            }
            // 针对处理后的表格独立处理
            if (nextChild.className === TABLE_PLACEHOLDER_CLASS_NAME) {
              // getRequiredNode(nextChild);
              appendToEnd.push(nextChild);
              continue;
            }

            content += nextChild.text;
          }
          child.content = content;
          child.children = [];
          serializedHtml.push(child);
          appendToEnd.forEach((item) => {
            serializedHtml.push(item);
          });
        }
      }
    } else {
      children.forEach((child) => {
        getRequiredNode(child);
      });
    }
  };

  // 抽取必须的节点，其余省略
  getRequiredNode(cloneDeep(htmlConstruct));

  // 转化一轮格式
  const docConstructWithTagName: DocConstructWithTagName[] = serializedHtml.map(
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

  const docConstructWithTag: DocConstructWithTag[] = [];

  // 最后整理数据结构
  for (let i = 0; i < docConstructWithTagName.length; i++) {
    const header: DocConstructWithTag & { tagName: string } = {
      ...docConstructWithTagName[i],
      tag:
        docConstructWithTagName[i].tagName === 'code'
          ? 'DEMO'
          : /API/.test(docConstructWithTagName[i].title)
          ? 'API'
          : 'TEXT',
    };

    if (header.tagName === 'h1') {
      docConstructWithTag.push(header);
    } else {
      if (
        header.tagName === 'code' ||
        header.className === TABLE_PLACEHOLDER_CLASS_NAME
      ) {
        if (i > 0) {
          let doneInsert = false;
          for (let j = i - 1; j > -1; j--) {
            const prevHeader = docConstructWithTagName[j];
            if (isTitle(prevHeader.tagName)) {
              prevHeader.toc.push(header);
              doneInsert = true;
              break;
            }
          }
          if (!doneInsert) {
            docConstructWithTag.push(header);
          }
        } else {
          docConstructWithTag.push(header);
        }
      } else {
        const tagNum = parseInt(header.tagName[1]);
        if (i > 0) {
          let doneInsert = false;
          for (let j = i - 1; j > -1; j--) {
            const prevHeader = docConstructWithTagName[j];
            if (parseInt(prevHeader.tagName[1]) < tagNum) {
              prevHeader.toc.push(header);
              doneInsert = true;
              break;
            }
          }
          if (!doneInsert) {
            docConstructWithTag.push(header);
          }
        } else {
          docConstructWithTag.push(header);
        }
      }
    }
  }

  return docConstructWithTag;
};
