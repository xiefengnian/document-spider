import * as cheerio from 'cheerio';

type SerializationHtml = {
  tag: string;
  text: string;
  children: SerializationHtml[];
};

export const getDocumentConstruct = (
  root: cheerio.Cheerio<cheerio.Element>
): SerializationHtml => {
  const fn = (
    ele: cheerio.NodeWithChildren | cheerio.Node,
    construct: SerializationHtml
  ) => {
    const children = (ele as cheerio.NodeWithChildren).children;
    children?.forEach((child) => {
      // @ts-ignore
      const nodeTagName = child.name;
      const result = {
        tag: nodeTagName,
        text: '',
        children: [],
      };
      console.log(child);
      if (child.type === 'text') {
        construct.text += (child as any).data;
      } else {
        construct.children.push(fn(child, result));
      }
    });
    return construct;
  };

  const result = fn(root.get(0), {
    // @ts-ignore
    text: root.get(0).data || '',
    tag: root.get(0).name,
    children: [],
  });

  return result;
};
