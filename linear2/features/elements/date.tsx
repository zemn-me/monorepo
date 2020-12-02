import React from 'react';
import * as elements from 'linear2/features/elements';
import * as model from 'linear2/model';

export const locale = React.createContext<readonly string[]>(["en-gb"]);

export interface DateProps extends Intl.DateTimeFormatOptions {
    date?: Date,
}

export const Date:
    (props: DateProps) => React.ReactElement
=
    ({ date, ...options }) => {
        const locales = React.useContext(model.lang.locale);
        const dto = Intl.DateTimeFormat(locales, options);

        return  <elements.WithLang lang={dto.resolvedOptions().locale}>
            <time {...date?{dateTime: date.toString()}:{} }>
                { dto.format(date) }
            </time>
        </elements.WithLang>
    }
;
