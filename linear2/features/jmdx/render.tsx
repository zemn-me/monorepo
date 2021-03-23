import React from 'react';
import * as unist from 'unist';
import * as types from './types'
import * as util from './util';
import * as mdast from 'mdast';

/*
    function createElement<P extends {}>(
        type: FunctionComponent<P>,
        props?: Attributes & P | null,
        ...children: ReactNode[]): FunctionComponentElement<P>;
    function createElement<P extends {}>(
        type: ClassType<P, ClassicComponent<P, ComponentState>, ClassicComponentClass<P>>,
        props?: ClassAttributes<ClassicComponent<P, ComponentState>> & P | null,
        ...children: ReactNode[]): CElement<P, ClassicComponent<P, ComponentState>>;
    function createElement<P extends {}, T extends Component<P, ComponentState>, C extends ComponentClass<P>>(
        type: ClassType<P, T, C>,
        props?: ClassAttributes<T> & P | null,
        ...children: ReactNode[]): CElement<P, T>;
    function createElement<P extends {}>(
        type: FunctionComponent<P> | ComponentClass<P> | string,
        props?: Attributes & P | null,
        ...children: ReactNode[]): ReactElement<P>;
*/

type ValueOf<T> = T[keyof T]

const elementToNode:
    <I extends types.Element<C>, C, D extends unist.Data>(el: I) => I 
=
    el => 
        ({
            ...el, ...el?.data?.hProperties,
            type: el?.data?.hName ?? el.type
        })
; 

const RenderSingleElement:
    <Type extends string, node extends { type: Type } & types.Element<React.ReactElement[]>>(props: {
        renderers: Record<Type, React.FC<node>>,
        node: node
     }) => React.ReactElement<node>
=
    <Type extends string, node extends { type: Type } & types.Element<React.ReactElement[]>>({renderers, node}: {
        renderers: Record<Type, React.FC<node>>,
        node: node
     }) =>
        RenderSingleNode<Type, node>({
            renderers: renderers, node: elementToNode(node)
        })
;

const RenderSingleNode:
    <Type extends string, node extends { type: Type } & types.Parent<React.ReactElement[]>>(props: {
        renderers: Record<Type, React.FC<node>>,
        node: node
     }) => React.ReactElement<node>
=
    <Type extends string, node extends { type: Type } & types.Parent<React.ReactElement[]>>({ renderers, node }: {
        renderers: Record<Type, React.FC<node>>,
        node: node
     })  => {
        renderers = {
            element: (node: types.Element<React.ReactElement[]>) => <RenderSingleElement<string, types.Element<React.ReactElement[]>> node={node} renderers={renderers as any}/>,
            ...renderers
        };

        if (!renderers.hasOwnProperty(node.type)) throw new Error(`missing definition for ${node.type}`);

        return React.createElement(renderers[node.type], node)
     }  
;

interface NodeRenderer<T> {
    (i: T): React.ReactNode
}

const MapChildren:
    <PropsWithoutChildren, C, O>(v: { children?: C[] } & PropsWithoutChildren, f: (i: C) => O) => PropsWithoutChildren & { children?: O[] }
=
     (v, f) => ({ ...v, children: v?.children?.map(f) })
;

function Adapt<P, IC>(v: (v: P & { children?: IC[] }) => React.ReactElement) {
    return <C extends any>(props: { node: P & { children?: C[] }, map: (v: C) => IC }) => v(MapChildren(props.node, props.map))
}

interface TreeRendererProps<N> {
    node: N
    Default?: (v: N) => React.ReactElement
}

export const isTreeRenderer = Symbol();
export type IsTreeRenderer = typeof isTreeRenderer;

export interface TreeRenderer<N> extends React.FC<TreeRendererProps<N>> {
    isTreeRenderer: IsTreeRenderer
}

export type Renderer<N> = TreeRenderer<N> | ((node: N) => React.ReactElement & { isTreeRenderer?: undefined })

function Render<Node>({node, Render}: { node: Node, Render: Renderer<Node> }) {
    return React.createElement(Render?.isTreeRenderer == isTreeRenderer? Render: Adapt( 
}


const Render:
    <NodeRenderers extends Record<string, React.FC>>(props: {
        renderers: NodeRenderers,
        node: types.Element
    }) => React.ReactElement
=
    ({ node, renderers }): React.ReactElement => {

        return null;
    }

;


const stringOrNullish:
    (v: unknown) => string | void
=
    v => typeof v == "string"? v: undefined
;


;

export type NormalizedNode = types.Node<never>

export const Render0:
    (props: types.Node | { reactElement: React.ReactElement }) => React.ReactElement
=
    (node) => {
        let children;
        ({ children, ...node } = node);
        const { render: renderer } = React.useContext(Context);

        let type = node?.data?.hName ?? node.type;
        let props = {};
        if (node?.properties) {
            props = { ...props, ...node?.properties };
            delete node.properties
        }
        if (node?.data?.hProperties) {
            props = { ...props, ...node?.data?.hProperties };
            delete node.data.hProperties;
        }

        if (node.type == 'element') {
            type = node.tagName;
        } else props = { ...props, ...node };

        props = { ...props, type };

        return React.cloneElement(renderer, {
            ...renderer.props, ...props,
            children: children
                    ? children.map((c, i) => <Render {...c} key={i}/>)
                    : null
        })
    }
;


export const RootRendererContext = React.createContext<any>(Render);


class ErrorBoundary extends React.PureComponent {
    constructor(props) { super(props); this.state = { hasError: false } }
    componentDidCatch(error, info) { console.error(error, errorInfo) }
    static getDerivedStateFromError(error) { return { hasError: true } }
    render() { return this.state.hasError? "error!": this.props.children }
}

export default Render;