
const ramp = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ";
class BaseConverter {
    constructor(ramp) { this.ramp = ramp }
    get zero() { return this.ramp[0] }
    get base() { return this.ramp.length }
    reverse(s) { return [...s].map((ch, i) => this.value(ch, i)).reduce((a, c) => a + c, 0) }
    convert(n) {
        let o = [];
        for(;;) {
            const remainder = n % this.base;
            n = Math.floor(n / this.base);

            o.push(this.ramp[remainder]);

            if (n === 0) break;
        }

        return o.reverse().join("");
    }
}

const conv = new BaseConverter(ramp);

const uniqueClass = (() => {
    let ctr = 0;
    const identsMap = new Map();
    return (context, _, localName) => {
        const key = [context.resourcePath, localName].join("__").trim();
        const v = identsMap.get(key);
        identsMap.set(key, v == undefined? ctr++: v);
        return conv.convert(identsMap.get(key));
    }
})()

const cssMinifierPlugin = config => ({
    ...config,
    webpack(wpcfg, ...a) {
		wpcfg.module.rules[1].oneOf.forEach((moduleLoader, i) => {
			Array.isArray(moduleLoader.use) && moduleLoader.use.forEach((l) => {
				if(l.loader.includes("css-loader")) {
					l.options = {
						...l.options,
                        modules: {
                            ...l.options.modules,
                            ...(
                                { getLocalIdent: uniqueClass }
                                //{}
                            )
                        }
					}
                }
			});
        });
        
        wpcfg.node = { fs: "empty" };
        if (config.webpack) wpcfg = config.webpack(wpcfg, ...a);
        return wpcfg;
    }
});


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
                })
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