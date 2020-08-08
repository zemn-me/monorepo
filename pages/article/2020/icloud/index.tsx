import Child from './icloud.mdx';
import { Article } from '@zemn.me/linear/article';


const A = () => <Article {...{
    title: "ok",
    written: null as any
}}>{Child}</Article>;


export default A;