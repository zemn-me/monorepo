import * as y2017 from './2017';
import * as y2019 from './2019';
import * as y2020 from './2020';

export const years = {
    2017: y2017,
    2019: y2019,
    2020: y2020
} as {
    readonly [year: number]: {
        readonly [name: string]: {
            readonly title?: string,
            readonly medium?: URL,
            readonly Component: React.Component | any,
            readonly date?: Date,
            readonly inShort?: string,
            readonly tags?: string[],
            readonly hidden?: boolean
        }
    }
}

