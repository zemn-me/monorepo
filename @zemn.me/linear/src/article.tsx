import React from 'react';

export interface Article {
    title: string,
    written: Date,
    component: React.ComponentType

}

export const Article:
    (props: Article) => React.ReactElement
=
    ({ title, written, component: Component }) => <>
        <Component/>
    </>
;