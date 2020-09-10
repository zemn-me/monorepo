
export interface YAMLObject {
    [key: string]: YAMLValue
}

export interface YAMLArray extends ReadonlyArray<YAMLValue> {}

export type YAMLValue = YAMLObject | number | string | YAMLArray | undefined

export interface FrontMatter {
    [key: string]: YAMLValue
}

export const isArrayOfStringsOrUndefined:
    (v: YAMLValue | undefined) => v is undefined | readonly string[]
=
    (v: YAMLValue | undefined): v is undefined | readonly string[] => {
        if (v == undefined) return true;
        if (!(v instanceof Array)) return false;
        if (!(v.every(((value): value is string => typeof value == "string"))))
            return false;

        return true;
    }
;