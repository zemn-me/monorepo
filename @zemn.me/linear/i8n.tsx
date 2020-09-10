import React from 'react';
import { Text as textComponent, IntoProp } from '@zemn.me/lang/component';
import { Lang, Text as TextType } from '@zemn.me/lang';
export type { Lang, TaggedText } from '@zemn.me/lang';
export { tag } from '@zemn.me/lang';
export {  Tagged } from '@zemn.me/lang/component';
export type { TextProps, IntoProp } from '@zemn.me/lang/component';

export type Text = TextType;
export const Text = textComponent;

export const locale = React.createContext<readonly string[]>(["en-gb"]);

export interface DateProps extends Intl.DateTimeFormatOptions,
    IntoProp {
    date: Date
}


export const Date:
    (props: DateProps) => React.ReactElement
=
    ({ date, into, ...etc }) => {
        const [l] = React.useContext(locale);
        return <Text into={into}>{[
            l,
            date.toLocaleString(l, etc)
        ] as readonly [Lang, string]}{}</Text>
    }
;
