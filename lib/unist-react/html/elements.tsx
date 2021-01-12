import { e, Element, pick } from './util';
import * as unist from 'unist';
import { Render } from 'lib/unist-react';
import { PropsOf } from 'linear2/features/elements/util';
const s = [ "children", "id", "className", "lang"] as const;

export const p = e("p", ...s);
export const ul = e("ul", ...s);
export const ol = e("ol", "start", ...s);
export const li = e("li",  ...s);
export const section = e("section", ...s);
export const strong = e("strong",  ...s);
export const h1 = e("h1",  ...s);
export const h2 = e("h2", ...s);
export const h3 = e("h3", ...s);
export const h4 = e("h4", ...s);
export const h5 = e("h5", ...s);
export const em = e("em", ...s);
export const code = e("code", ...s);
export const aside = e("aside", ...s);
export const blockquote = e("blockquote", ...s);
export const sup = e("sup", ...s);
export const hr = e("hr");
export const dl = e("dl", ...s);
export const dt = e("dt", ...s);
export const img = e("img", "src", "id", "title");
export const dd = e("dd", ...s);
export const input = e("input", "type", "checked", "disabled");
export const figure = e("figure", "id", "children");
export const figcaption = e("figcaption", "id", "children");
export const del = e("del", ...s);
export const div = e("div", ...s);
export const main = e("main", ...s);
export const span = e("span", ...s);

export const a: React.FC<Element<"a">> = ({ href, ...a }) => {
    if (!/^https?:\/\/|^#/.test(href??"")) href = undefined;
    return <a {...{href, ...pick(a, "title", ...s) }}/>
}


export const comment: React.FC = () => null;
