export type Primitive = string | number | boolean | null | undefined;

export type Value = Object | Array | Primitive;

export interface Object extends Record<string, Value> {}

export type Array = Value[];
