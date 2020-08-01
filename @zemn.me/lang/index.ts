export type Lang =
    'en-GB' | 'de-DE' | 'ja-JP' | 'nl';


/**
 * TaggedText represents a Bcp47 tagged textual string.
 */
export type TaggedText = readonly [Lang, React.ReactChild];

/**
 * Segment represents a selection of multiple TaggedText pieces,
 * each of which describes a possible choice of language string.
 */
export type Text = TaggedText | readonly [TaggedText, ...TaggedText[]];

export const tag:
    (lang: Lang) => (text: TemplateStringsArray, ...text2: { toString(): string }[]) =>
        TaggedText
    =
    lang => (text, ...text2) => {
        let o: string[] = [];
        for (let i = 0; i < Math.max(text.length, text2.length); i++)
            o.push(
                text[i] ?? "",
                (text2[i] ?? "").toString()
            );
        return [lang, o.join("")] as const;
    }
    ;

export const textIsTaggedText =
    (text: Text): text is TaggedText =>
        (typeof text[0]) == "string"