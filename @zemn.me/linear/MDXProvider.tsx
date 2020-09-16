import { fromEntries } from './fromEntries';
import * as elements from './elements';
import { MDXProvider } from '@mdx-js/react';

export const components = fromEntries(Object.entries(elements).map( ([k, v]) => 
    [k[0].toLowerCase()+k.slice(1), v]
));

export const proseComponents = {
    ...components,
    img: elements.ProseImg,
    h1: elements.Heading,
    h2: elements.Heading,
    h3: elements.Heading,
    h4: elements.Heading,
    h5: elements.Heading,
    section: elements.ProseSection
};


export const Provider:
    React.FC
=
    ({ children }) => <MDXProvider {...{components}}>
        {children}
    </MDXProvider>
;

export const Prose:
    React.FC
=
    ({ children }) => <MDXProvider {...{
        components: proseComponents,
    }}>
        {children}
    </MDXProvider>
;

export default Provider;

