import React from 'react';
import { must } from './guard';

export type RegisterProps = {
    anchor: string,
    title: string,
    level: number,
    node: Node
}

export type Index = readonly RegisterProps[]

export interface Ctx {
    register(Props: RegisterProps): [unregister: () => void]
    onChange(then: (index: TreeNode) => void): [removeEventListener: () => void]
}

const DOCUMENT_POSITION_DISCONNECTED = 1 as const;
const DOCUMENT_POSITION_PRECEDING = 2 as const;
const DOCUMENT_POSITION_FOLLOWING = 4 as const;
const DOCUMENT_POSITION_CONTAINS = 8 as const;
const DOCUMENT_POSITION_CONTAINED_BY = 16 as const;
const DOCUMENT_POSITION_IMPLEMENTATION_SPECIFIC = 32 as const;

export interface TreeNode {
    self?: RegisterProps;
    children?: TreeNode[];
    parent?: TreeNode
}

export class Ctx {
    private reg = new Set<((index: TreeNode) => void)>();
    private nodes = new Map<Node, RegisterProps>();
    private sects: readonly RegisterProps[] = [];
    private tree: TreeNode = {};
    register(props: RegisterProps): [unregister: () => void] {
        const { node } = props;
        this.nodes.set(node, props);
        this.handleChange();
        return [() => this.unregister(node)]
    }

    unregister(node: Node) {
        this.nodes.delete(node);
        this.handleChange();
    }

    onChange(then: ((index: TreeNode) => void)): [ removeEventListener: () => void] {
        this.reg.add(then);
        then(this.tree);
        return [() => this.reg.delete(then)]
    }


    private handleChange() {
        this.sects = [...this.nodes.values()].sort(({ node: a }, { node: b }) => {
            const cmp = a.compareDocumentPosition(b);
            for (const i of [
                DOCUMENT_POSITION_DISCONNECTED,
                DOCUMENT_POSITION_CONTAINS,
                DOCUMENT_POSITION_CONTAINED_BY,
                DOCUMENT_POSITION_IMPLEMENTATION_SPECIFIC
            ]) {
                if (cmp & i) throw new Error(`${i}`);
            }
            if (cmp & DOCUMENT_POSITION_PRECEDING) return 1;
            if (cmp & DOCUMENT_POSITION_FOLLOWING) return -1;

            throw new Error();
        });


        const root: TreeNode = {};

        let cur = root;

        for (let sect of this.sects) {
            while (!(cur?.self?.level == undefined || cur?.self?.level < sect.level)) {
                if (cur.parent == undefined) throw new Error();
                cur = cur.parent;
            }

            if (cur.parent !== undefined && sect.level == cur?.self?.level) cur = cur.parent;

            const n = { self: sect, parent: cur };

            cur.children = [...(cur.children??[]), n];

            cur = n
        }

        this.tree = root;


        [...this.reg.values()].forEach(fn => fn(this.tree));

        
        // TODO!!
    }
}

export const context = React.createContext<Ctx | undefined>(undefined);

export const useProvideSection:
    (level: number) => [ref: React.MutableRefObject<HTMLHeadingElement| null>, title: string | undefined]
=
    (level) => {
        const ind = React.useContext(context);
        const ref = React.useRef<HTMLHeadingElement>(null);
        const [title, setTitle] = React.useState<string>();
        React.useLayoutEffect(() => {
            if (!ind) return;
            const { current: node } = ref;
            if (!node) return;

            const title = node.textContent;
            if (!title) return;

            setTitle(title);
            const [unregister] = ind.register({anchor: title, title, level, node});
            return unregister;
        }, [])
        return [ref, title];
    }
;