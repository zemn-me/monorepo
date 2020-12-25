const mdx = require("@mdx-js/mdx");




const mdxPlugin = config => {
    config = require('next-mdx-enhanced')({
        remarkPlugins: [
            require('remark-validate-links'),
            require('remark-sub-super'),
            require('remark-heading-id'),
            require('remark-footnotes'),
            require('remark-lint-no-undefined-references'),
            require('remark-lint-no-heading-like-paragraph'),
            // addresses a specific 'quotes around code quotes' issue
            // ex: '`something`'
            () => (tree) => require('unist-util-visit-parents')(
                tree, node => node.type == "text"
                    && (node.value.endsWith("'") || node.value.endsWith('"')),
                (node, ancestors) => {
                    const endsWith = node.value.slice(-1)[0];
                    const parent = ancestors.slice(-1)[0];
                    const i = parent.children.indexOf(node);
                    if (i == -1) throw new Error("child not parented to parent");
                    const [ maybeCodeQuote, maybeText ] = [
                        parent.children[i+1],
                        parent.children[i+2]
                    ];

                    if (!(maybeCodeQuote || maybeText)) return;
                    if (maybeCodeQuote.type !== "inlineCode") return;
                    if (maybeText.type !== "text") return;
                    if (!(maybeText.value.startsWith(endsWith))) return;

                    if (endsWith == "'") {
                        node.value = node.value.slice(0, -1) + "‘";
                        console.log(maybeText.value);
                        maybeText.value =  "’" + maybeText.value.slice(1)
                    }
            }),
            [require('remark-captions'), {
                internal: {
                    image: 'Figure:',
                    blockquote: '-- '
                }
            }],

            require('@silvenon/remark-smartypants'),
            require('./typography.js'),

            require('./sectionize.js'),


        ],
        rehypePlugins: [
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

            // expose page titles as exported elements
            (() => {
                const compiler = mdx.createCompiler();
                return () => tree => require('unist-util-visit-parents')(
                    tree, node => node.type == 'element' && node.tagName == 'h1', (node, parents) => {
                        const rootNode = parents.find(nd => nd.type='root')
                        if (!rootNode) throw new Error("cannot add page title as exported element: no root note found in path to h1");
                        rootNode.children.push({ type: 'export', value: `export const Title = ${compiler.stringify(node)};` });
                    }
                )
            })()
        ]
    })(config);

    return config;
}

const plugin = config => {
    config = require('next-videos')({
        // i cannot explain why this makes it work, but it does
        assetDirectory: 'static',
        ...config
    });

    config = require('next-images')(config);

    config = mdxPlugin(config);
    config = cssMinifierPlugin(config);

    return config;
}

module.exports = {
    plugin,
    default: plugin
}