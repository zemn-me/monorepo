import React from 'react';
import * as types from './types'
import * as util from './util';
import * as mdast from './nodes/mdast';

export type RendererProps = types.Node & { fallback?: React.ReactElement<RendererProps> }

interface RenderContextProps {
    render: React.ReactElement<RendererProps>
}

export const DefaultRenderer: (props: RendererProps) => React.ReactElement =
    ({ fallback, ...onode }) => {
        const { type = "unknown", ...node } = { ...onode };
        switch (type) {
        case 'reactNode':
            return node.value;
        }

        if (fallback) return React.cloneElement(fallback, { ...fallback.props, ...onode });
        throw new Error(`unhandled ${type}`);
    }

export const Context = React.createContext<RenderContextProps>({
    render: <DefaultRenderer fallback={<mdast.Render/>}/>
});


export const Render:
    (props: types.Node | { reactElement: React.ReactElement }) => React.ReactElement
=
    (node) => {
        React.isValidElement(node);
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