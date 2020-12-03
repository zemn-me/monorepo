import React from 'react';

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

