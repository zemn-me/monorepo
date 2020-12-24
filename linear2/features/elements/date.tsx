import React from 'react';
import * as elements from 'linear2/features/elements';
import * as model from 'linear2/model';
import * as elementUtil from 'linear2/features/elements/util';

export const locale = React.createContext<readonly string[]>(["en-gb"]);

export interface DateProps extends Intl.DateTimeFormatOptions, elementUtil.PropsOf<"time"> {
    date?: Date,
    children?: React.ReactNode
}

export const Date:
    (props: DateProps) => React.ReactElement
=
    ({ date, children, ...options }) => {
        if (children) return <time {...date?{dateTime: date.toString()}:{}} {...options}>{children}</time>
        
        const locales = React.useContext(model.lang.locale);
        const dto = Intl.DateTimeFormat(locales, options);

        return  <elements.WithLang lang={dto.resolvedOptions().locale}>
            <time {...date?{dateTime: date.toString()}:{} } {...options}>
                { dto.format(date) }
            </time>
        </elements.WithLang>
    }
;
