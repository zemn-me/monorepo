import React from 'react';
type Node = any


export type RendererProps = Node & { fallback: React.ReactElement<Node> }

export interface RenderHtmlContextProps {
    render: React.ReactElement<RendererProps>
}

export const DefaultHtmlRenderer: (props: RendererProps) => React.ReactElement =
    ({ fallback, ...onode }) => {
        console.log("default html renderer");
        const { type = "unknown", ...node } = {...onode};
        delete node.position; delete node.idx; delete node.data;
        if (node.children?.length == 0) delete node.children;
        switch (type) {
            case 'root': return node.children;

            case 'text': return <>{node.value}</>;

            case 'comment': case 'definition': return null;

            case 'figure':
            case 'a': case 'em': case 'p': case 'ul': case 'ol':
            case 'img': case 'em': case 'dl': case 'dt': case 'dd':
            case 'blockquote': case 'li': case 'strong': case 'code':
            case 'meta': case 'section': case 'h1': case 'h2': case 'h3':
            case 'h4': case 'h5': case 'h6': case 'aside': case 'hr':
                return React.createElement(type, node);
        }

        return React.cloneElement(fallback, { ...fallback.props, ...onode });
    }

const Unknown: React.FC<any> = ({ type }: any) => `<${type}/>`;

export const Context = React.createContext<RenderHtmlContextProps>({
    render: <DefaultHtmlRenderer fallback={<Unknown/>}/>
});


export const Render: (props: Node) => React.ReactElement =
    ({ ...node }) => {
        console.log("renderHTML");
        const { render: renderer } = React.useContext(Context);
        return React.cloneElement(renderer, { ...renderer.props, ...node });
    }

