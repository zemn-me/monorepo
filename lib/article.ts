import { frontMatter } from '../pages/article/**/*.mdx';
import * as jsx from '@zemn.me/linear/jsx';
import { trustedRelativeURL } from '@zemn.me/linear/url';
import * as simpledate from '@zemn.me/simpletime/date';

declare module '../pages/article/**/*.mdx' {
    export const _importMeta: readonly {
        readonly absolutePath: string,
        readonly importedPath: string
    }[];

    export const frontMatter: readonly (jsx.FrontMatter & {
        __resourcePath: trustedRelativeURL  
    })[];
}

interface ExpectedMetadata {
    readonly layout: string,
    readonly title: string,
    readonly language: string,
    readonly subtitle?: string,
    readonly tags?: readonly string[],
    readonly author?: string,
    readonly date: Date,
    readonly hidden?: boolean
}

const layoutNotString = Symbol();
const titleNotString = Symbol();
const languageNotString = Symbol();
const subtitleNotUndefinedOrString = Symbol();
const authorNotUndefinedorString = Symbol();
const tagsNotArrayOfStringsOrUndefined = Symbol();
const dateNotArray = Symbol();

const symError:
    (v: { [key: string]: symbol }) => Error
=
    v => new Error(Object.keys(v)[0])
;



export const mustExpectedMeta:
    (data: jsx.FrontMatter) => ExpectedMetadata
=
    data => {
        const { layout, title, language, subtitle, tags, author, date } = data;
        console.log(typeof layout);
        if (!(typeof layout == "string")) throw symError({ layoutNotString });
        if (!(typeof title == "string")) throw symError({ titleNotString })
        if (!(typeof language == "string")) throw symError({ languageNotString });
        if (subtitle !== undefined)
            if (!(typeof subtitle == "string")) throw symError({ subtitleNotUndefinedOrString });


        if (author !== undefined)
            if (!(typeof author == "string")) throw symError({ authorNotUndefinedorString });

        if (!jsx.isArrayOfStringsOrUndefined(tags)) throw symError({ tagsNotArrayOfStringsOrUndefined });

        if (!(date instanceof Array)) throw symError({ dateNotArray });

        return { layout, title, language, subtitle, tags, author,
            date: simpledate.Parse(date as any as simpledate.SimpleDate)
         }
    }
;

export const articles = 
    frontMatter.map(md => {
        try { return {...md, ...mustExpectedMeta(md)} } catch(e) {
            console.log(e, md);
            return undefined   
        }
    }).filter(<T>(v: T | undefined): v is T => v !== undefined).filter(v =>
        (! ("hidden" in v) && v.hidden) )