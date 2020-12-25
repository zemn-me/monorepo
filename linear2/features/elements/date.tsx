import React from 'react';
import * as elements from 'linear2/features/elements';
import * as model from 'linear2/model';
import * as elementUtil from 'linear2/features/elements/util';
import { Style } from 'linear2/features/elements/style';

export const locale = React.createContext<readonly string[]>(["en-gb"]);

export const dateContext = React.createContext<Date|undefined>(undefined);

export interface DateProps extends  elementUtil.PropsOf<"time"> {
    date?: Date,
}

export const Date:
    (props: DateProps) => React.ReactElement
=
    ({ date, children, ...props }) => {
        return <dateContext.Provider value={date}>
            <Style>
                <time {...date?{dateTime: date.toString()}:{}} {...props}>
                    {children}
                </time>
            </Style>
        </dateContext.Provider>

    }
;


export interface TextProps extends Intl.DateTimeFormatOptions { }

export const Text:
    (props: TextProps) => React.ReactElement | null
=
    options => {
        const locales = React.useContext(model.lang.locale);
        const date = React.useContext(dateContext);
        const dto = Intl.DateTimeFormat(locales, options);
        
        if (!date) return null;

        return <elements.WithLang lang={dto.resolvedOptions().locale}>
                <span>{ dto.format(date) }</span>
        </elements.WithLang>
    }
;
