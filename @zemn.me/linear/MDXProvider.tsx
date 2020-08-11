import { fromEntries } from './fromEntries';
import * as elements from './elements';
import { MDXProvider } from '@mdx-js/react';

const components = fromEntries(Object.entries(elements).map( ([k, v]) => 
    [k[0].toLowerCase()+k.slice(1), v]
));

export const Provider:
    React.FC
=
    ({ children }) => <MDXProvider {...{components}}>
        {children}
    </MDXProvider>
;

export default Provider;

