import { frontMatter } from '../pages/article/**/*.mdx';
import * as guards from 'lib/guards';
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
    readonly autonumber?: AutoNumber
}

const AUTO_NUMBER_SEQUENCE_TYPE = [ "alphanumeric" ] as const;
type AutoNumberSequence = (typeof AUTO_NUMBER_SEQUENCE_TYPE) extends
    ReadonlyArray<infer A> ? A : never;

function isAutoNumberSequence(v: unknown): v is AutoNumberSequence {
   return AUTO_NUMBER_SEQUENCE_TYPE.some(val => val == v)
}

interface AutoNumber extends jsx.YAMLObject {
    sequence: (typeof AUTO_NUMBER_SEQUENCE_TYPE) extends ReadonlyArray<infer A>
        ? A
        : never;

    separator: string
    prefix?: string
}

export const mustAutoNumber:
    (v: jsx.YAMLObject) => AutoNumber
=
    ({ sequence, separator, prefix }): AutoNumber => {
        guards.must(isAutoNumberSequence, sequence);

        guards.must(guards.isString, separator);

        guards.must(guards.any(guards.isUndefined, guards.isString), prefix);

        return { sequence, separator, prefix }

    }
    
;


export const mustExpectedMeta:
    (data: jsx.FrontMatter) => ExpectedMetadata
=
    data => {
        const { layout, title, language, subtitle, tags, author, date,
            autonumber } = data;
        guards.must(guards.isString, layout);
        guards.must(guards.isString, title);
        guards.must(guards.isString, language);
        guards.must(guards.any(
            guards.isString,
            guards.isUndefined), subtitle);

        guards.must(guards.any(
            guards.isString,
            guards.isUndefined), author);

        guards.must(
            guards.any(
                guards.all(
                    guards.isArray,
                    guards.isArrayOf(
                        guards.isString
                    )
                ),
                guards.isUndefined
            ),
            tags
        )

        guards.must(
            guards.all(
                guards.isArray,
                guards.isArrayOf(
                    guards.any(
                        guards.isString,
                        guards.isNumber
                    )
                )
            ),
            date
        );

        const an = autonumber !== undefined? mustAutoNumber(autonumber as any): undefined;

  
        return { layout, title, language, subtitle, tags, author, autonumber: an,
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