import all from 'mdast-util-to-hast/lib/all';


const own = {}.hasOwnProperty

export const mirrorRevive = (() => {
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
                    nd.properties = nd.properties || {}
                    nd.properties.nodeProps = mappings.get(+nd.properties.idx)
                    delete nd.properties["idx"];
                    if (nd.properties.children) delete nd.properties["children"]
                }

                if (nd.children) for(const child of nd.children) visit(child);
            }

            return visit
        }
    }
});

