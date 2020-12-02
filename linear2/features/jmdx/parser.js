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

    return await compiler.run(compiler.parse(file));
}

