import * as lang from '.';
import React from 'react';

interface IntoProp {
    into?:
    React.ReactElement<{ lang?: string, children?: React.ReactChild }>
}

interface TextProps extends IntoProp {
    children: lang.Text,
    lang: lang.Lang,

}

/**
 * Text is a component which renders a set of language-tagged text options
 * to a concrete value.
 */
export const Text:
    (props: TextProps) => React.ReactElement
    =
    ({ children, lang: _lang, into }) => {
        if (lang.textIsTaggedText(children)) return <Tagged {...{
            lang: children[0], children: children[1], into
        }} />

        let choice: lang.TaggedText | undefined;
        for (const opt of children)
            if (opt[0] == _lang) choice = opt;

        if (!choice) choice = children[0];

        {
            const [lang, children] = choice;
            return <Tagged {...{
                lang, children, into
            }} />
        }
    }


export interface TaggedProps extends IntoProp {
    lang: lang.Lang,
    children: React.ReactChild
}

interface TaggedTextContext {
    lang: string
}

const TaggedTextContext = React.createContext<TaggedTextContext | undefined>(undefined);


export const Tagged:
    (props: TaggedProps) => React.ReactElement
    =
    ({ lang, children, into = <span /> }) => {
        const ctx = React.useContext(TaggedTextContext);

        let child = React.cloneElement(
            into, { ...into.props, lang, children });


        // if we already have a contextual lang, and it's this
        // one, there's nothing special to do.
        if (lang == ctx?.lang) return child;

        // otherwise, we need to assign a lang to ourselves
        // and our children
        return <TaggedTextContext.Provider value={{ lang }}>
            {child}
        </TaggedTextContext.Provider>
    }
    ;;;;;