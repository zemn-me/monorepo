import * as jmdx from 'linear2/features/jmdx/jmdx';

const fs = require("fs");
const unified = require('unified');
const vfile = require("to-vfile");
const path = require("path");
const util = require("util");
//const report = require("vfile-reporter");
const markdown = require("remark-parse");
const format = require('rehype-format');
const raw = require('rehype-raw');
const remark2Rehype = require('remark-rehype');
const u = require('unist-builder');

const remarkPlugins = [
    require('remark-validate-links'),
    require('remark-sub-super'),
    require('remark-heading-id'),
    require('remark-footnotes'),
    require('remark-lint-no-undefined-references'),
    require('remark-lint-no-heading-like-paragraph'),
    // addresses a specific 'quotes around code quotes' issue
    // ex: '`something`'
    () => tree => require('unist-util-visit-parents')(
        tree, node => node.type == "text"
            && (node.value.endsWith("'") || node.value.endsWith('"')),
        (node, ancestors) => {
            const endsWith = node.value.slice(-1)[0];
            const parent = ancestors.slice(-1)[0];
            const i = parent.children.indexOf(node);
            if (i == -1) throw new Error("child not parented to parent");
            const [maybeCodeQuote, maybeText] = [
                parent.children[i + 1],
                parent.children[i + 2]
            ];

            if (!(maybeCodeQuote || maybeText)) return;
            if (maybeCodeQuote.type !== "inlineCode") return;
            if (maybeText.type !== "text") return;
            if (!(maybeText.value.startsWith(endsWith))) return;

            if (endsWith == "'") {
                node.value = node.value.slice(0, -1) + "‘";
                console.log(maybeText.value);
                maybeText.value = "’" + maybeText.value.slice(1)
            }
        }),
    [require('remark-captions'), {
        internal: {
            image: 'Figure:',
            blockquote: '-- '
        }
    }],

    require('@silvenon/remark-smartypants'),
    require('linear2/features/mdx/typography.js'),

    require('linear2/features/mdx/sectionize.js'),


];

const rehypePlugins = [
    () => (tree) => require('unist-util-visit-parents')(
        tree, node => node.type == "element" && node.tagName == "div"
            && node.properties && node.properties.className == 'footnotes',
        (node) => {
            node.tagName = "Footnotes"
        }),

    // replace pre -> code with custom 'CodeBlock' element
    () => (tree) => require('unist-util-visit-parents')(
        tree, node => node.type == "element"
            && node.tagName == "pre"
            && node.children.length == 1
            && node.children[0].type == "element"
            && node.children[0].tagName == "code",
        (node, parents) => {
            const immediateParent = [...parents].pop();
            const myIndex = immediateParent.children.indexOf(node);
            node = immediateParent.children[myIndex] = node.children[0];
            node.tagName = "CodeBlock"
        }),
];


function text(node) {
  var data = node.data || {}

  if (
    own.call(data, 'hName') ||
    own.call(data, 'hProperties') ||
    own.call(data, 'hChildren')
  ) {
    return false
  }

  return 'value' in node
}

var own = {}.hasOwnProperty
const all = require('mdast-util-to-hast/lib/all');

export async function getStaticProps() {
    const content = 
            await vfile.read(path.join(process.cwd(), "pages", "article", "2020", "icloud", "index.mdx"))


    // i can only describe the way remark-rehype works as 'obnoxious'
    // its composed of a bunch of recursive functions with single letter or verb names
    // that make no desc of what they do. objects you return appear to be ignored for the
    // most part, and often modified.
    // after spending 3 days fighting it, this simply assigns an identifier to the
    // original properties of the node, and re-adds its properties later as a transform
    const { mirrorNode, reviveNode } = (() => {
        const mappings = new Map();
        let ctr = 0;

        const assignIdx = (node) => {
            mappings.set(ctr, node);
            return ctr++
        }

        return {
             mirrorNode(h, node) {
                 return {
                    properties: { idx: assignIdx(node) },
                    type: 'element',
                    tagName: node.type,
                    children:    all(h, node)
                    }
             },
   

            reviveNode() {
                const visit = nd => {
                    if (nd.properties && nd.properties.idx) {
                        nd.properties = mappings.get(+nd.properties.idx)
                        delete nd.properties["idx"];
                        if (nd.properties.children) delete nd.properties["children"]
                    }

                    if (nd.children) for(const child of nd.children) visit(child);
                }

                return visit
            }
        }
    })();

    const compiler = unified()
        //.use(markdown().use(remarkPlugins))
        .use(markdown)
        // the sink for this is not actually raw HTML, it's
        // DOM nodes that are allowlisted
        .use(remarkPlugins)
        .use(remark2Rehype, {allowDangerousHtml: true, handlers: {
            thematicBreak: mirrorNode,
            blockquote: mirrorNode,
            code: mirrorNode,
            //inlineCode: mirrorNode,
            footnoteReference: mirrorNode,
            footnote: mirrorNode,
            heading: mirrorNode,
            list: mirrorNode,
            listItem: mirrorNode,
            toml: mirrorNode,
            yaml: mirrorNode,
            heading: mirrorNode
        }, unknownHandler: mirrorNode})
        .use(raw)
        .use(format)
        .use(reviveNode)

    const ast = await compiler.run(compiler.parse(content));

    return { props: { ast: JSON.parse(JSON.stringify(ast)) } }
}

export default function Render(props) {
    return <jmdx.Render {...props.ast}/>
}