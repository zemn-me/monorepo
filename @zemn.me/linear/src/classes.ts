import * as iter from './itertools';

export const classes:
    (...classes: (string | undefined)[]) => {} | {
        className: string
    }

    =

    (...classes) => {
        console.log(classes);
        const definedClasses = [...iter.uniq(iter.filter(
            classes, (v: string | undefined): v is string => v !== undefined && v.trim() != ""
        ))];

        if (!definedClasses.length) return {};

        return { className: definedClasses.join(" ") }
    }

    ;

export default classes;