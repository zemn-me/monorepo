import React from 'react';
import { A, Div } from '@zemn.me/linear/elements';


export interface NavProps {
    className?: string
}

export const Nav = ({className}: NavProps) => <Div className={className}>
    <A href="/">Home</A>
    <A href="/article">Articles</A>
</Div>

export const cmp = () => <div>ok</div>;

export default cmp;