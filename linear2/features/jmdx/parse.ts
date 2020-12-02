import * as types from './types';
import { parse as parser } from './parser';

export const parse: 
    (vfile: any) => Promise<types.Root>
=
    parser as any
;

export default parse;