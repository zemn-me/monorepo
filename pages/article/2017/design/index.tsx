import Child from './design.mdx';
import * as whatever from './design.mdx';
import { Article } from '@zemn.me/linear/article';

console.log(whatever);


const A = () => <Article {...{
    title: "ok",
    written: null as any
}}>{Child}</Article>;


export default A;