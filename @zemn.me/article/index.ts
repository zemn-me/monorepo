import * as y2017 from './2017';
import * as y2019 from './2019';
import * as y2020 from './2020';

export const years = {
    y2017, y2019, y2020
} as const;

export const all = [
    ...Object.values(y2019),
    ...Object.values(y2020),
    ...Object.values(y2017)
] as readonly {
    date?: Date,
    medium?: URL,
    inShort?: string
}[];

export default all;
