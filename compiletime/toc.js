const toJSX = require('@mdx-js/mdx/mdx-hast-to-jsx');
const { info } = require('console');

function toc(options = {}) {
    // replace the mdx compiler with our sneakier one
    const oldCompiler = this.Compiler;

    this.Compiler = tree => {
        const code = oldCompiler(tree, {}, options)

        if (!info.hasTableOfContentsExport) {
            code += `\nexport const tableOfContents =` +
                `${
                    tocSerializer(info.tableOfContents)   
                }`
        }
    }

    return function transformer(node) {
        info = getInfo(node, options);
    }
}