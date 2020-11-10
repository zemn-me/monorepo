import * as base from './headingsAndSections';
import React from 'react';

export const Section = React.forwardRef<base.HTMLSectionElement, base.SectionProps> (
    props => <base.Section {...{
        ...props,
        withSectionMarkers: true
    }}/>
);


