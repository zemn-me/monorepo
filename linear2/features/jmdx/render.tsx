import React from 'react';
import * as types from './types'

export const RenderElement:
    <P extends { children?: React.ReactNode }>(props: { element: React.ReactElement<P>, props: P}) => React.ReactElement
=
    ({ element, props: { children, ...props } }) => {
        if (React.Children.count(children) > 0) return React.cloneElement(
            element,
            { ...element.props, ...props, children },
        );

        return React.cloneElement(element, { ...element.props , ...props });
    }
;

export const Render:
    (props: { node: types.Node, render: React.ReactElement<types.Node>}) => React.ReactElement
=
    ({ node: { children, ...node }, render }) => {
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
        console.log(props);

        return <RenderElement {...{
            element: render,
            props: {
                ...props,
                children: children
                    ? children.map((c, i) => <Render node={c} render={render} key={i}/>)
                    : null
            }
        }}/>;
    }
;


export default Render;