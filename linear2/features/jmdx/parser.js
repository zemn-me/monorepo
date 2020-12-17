import unified from 'unified';
import markdown from 'remark-parse';
import format from 'rehype-format';
import remark2Rehype from 'remark-rehype';
import * as remark2RehypeUtil from './remark2rehype/util';
import remarkPlugins from './remark';
import rawToElement from 'hast-util-raw'
import visit from 'unist-util-visit-parents';
import Parser from 'parse5/lib/parser';
import raw from 'hast-util-raw';
import frontmatter from 'remark-frontmatter';


/*
function parseRaw() {
    const parser = new Parser({ sourceCodeLocationInfo: true, scriptingEnabled: true });
    return tree => {
        visit(tree, node => node.type === 'html', node => {
            const { value: html } = node;

            node.parsed = parser(html);
        })
    }
}*/

export async function parse(file) {
    const compiler = unified()
        .use(markdown)
        .use(remarkPlugins)
        .use(() => tree => console.log(tree))
        .use(() => {
            let ctr = 0;
            let m = new Map();
            
            return tree => {
                visit(tree, node => node.type == 'html', node => node.type = 'raw');
                visit(tree, node =>
                    // omit all elements that are already HAST elements
                    node.type !== "root" && node.type !== "raw" && node.type !== "element"
                    && node.type !== "text" && node.type !== "comment",
                    node => {
                        // we sneak an index in that won't break the raw nodes
                        // which get reparsed from html. as such, they don't
                        // have any of the original node parameters.
                        node.properties = node.properties || {}
                        m.set(node.properties.idx = ctr++, {...node});
                        node.type = 'element'
                        node.tagName = 'div'
                    }
                )

                tree = raw(tree)

                visit(tree, node => ("properties" in node) && ("idx" in node.properties), node => {
                    const original = m.get(+node.properties.idx);
                    const children = node.children;

                    for (const k of Object.keys(node)) delete node[k];
                    Object.assign(node, original, { children });
                });

                return tree
            }
        })
        .use(format)
        // apply 'url' to references
        .use(() => {

            return tree => {
                const referenceNames = new Map();
                visit(tree, node => node.type == 'definition', node => {
                    //const { identifier, label, title, url }) = node;
                    referenceNames.set(node.identifier, node);
                })

                visit(tree, node => node.type == 'linkReference', node => {
                    const ref = referenceNames.get(node.identifier) || {};
                    Object.assign(node, {
                        title: node.title? node.title:  ref.title,
                        url: node.url? node.url: ref.url
                    });
                })
                return tree;
            }
        })
        // moves all used footnoteDefinitions to the footer
        .use(() => {
            const referenceNames = new Map();

            return tree => {
                visit(tree, node => node.type == 'footnoteDefinition', node => {
                    referenceNames.set(node.identifier, node);
                });

                const usages = new Set();
                visit(tree, node => node.type == 'footnoteDefinition', (node, parents) => {
                    const immediateParent = parents.slice(-1)[0];
                    const idx = immediateParent.children.indexOf(node);
                    immediateParent.children = immediateParent.children.slice(0, idx).concat(
                        immediateParent.children.slice(idx+1)
                    );
                    delete immediateParent.children[immediateParent.children.indexOf(node)];
                    usages.add(node.identifier);
                });

                for (const key of referenceNames.keys()) {
                    if (!usages.has(key)) referenceNames.delete(key);
                }

                tree.children.push({
                    type: 'footnotes',
                    children: [...referenceNames.values()]
                })


                return tree;
            }
        })

    return await compiler.run(compiler.parse(file));
}

