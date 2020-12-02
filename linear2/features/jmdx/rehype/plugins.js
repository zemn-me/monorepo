export default [
    /*
    () => (tree) => require('unist-util-visit-parents')(
        tree, node => node.type == "element" && node.tagName == "div"
            && node.properties && node.properties.className == 'footnotes',
        (node) => {
            node.tagName = "Footnotes"
        }),

        likely not needed due to new jmdx syntax
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
        }),*/
]