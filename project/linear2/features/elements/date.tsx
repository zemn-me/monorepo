import * as elements from 'linear2/features/elements';
import { Style } from 'linear2/features/elements/style';
import * as elementUtil from 'linear2/features/elements/util';
import * as model from 'linear2/model';
import React from 'react';

export const locale = React.createContext<readonly string[]>(['en-gb']);

export const dateContext = React.createContext<Date | undefined>(undefined);

export interface DateProps extends elementUtil.PropsOf<'time'> {
	date?: Date;
}

export const Date: (props: DateProps) => React.ReactElement = ({
	date,
	children,
	...props
}) => (
	<dateContext.Provider value={date}>
		<Style>
			<time {...(date ? { dateTime: htmlDate(date) } : {})} {...props}>
				{children}
			</time>
		</Style>
	</dateContext.Provider>
);

export type TextProps = Intl.DateTimeFormatOptions;

export const Text: (
	props: TextProps
) => React.ReactElement | null = options => {
	const locales = React.useContext(model.lang.locale);
	const date = React.useContext(dateContext);
	const dto = Intl.DateTimeFormat([...locales], options);

	if (!date) return null;

	return (
		<elements.WithLang lang={dto.resolvedOptions().locale}>
			<elements.Void>
				<span>{dto.format(date)}</span>
			</elements.Void>
		</elements.WithLang>
	);
};

/**
 * HTML5 date format
 * @see https://html.spec.whatwg.org/multipage/common-microsyntaxes.html#dates
 */
const htmlDate: (d: Date) => string = d =>
	`${htmlMonthString(d)}-${ensurePad(d.getUTCDate().toString(), 2, '0')}`;
/**
 * ensure a given string is of a given minimum length.
 * `pad` must be a single character.
 */
const ensurePad: (s: string, n: number, pad: string) => string = (s, n, p) =>
	p.repeat(n - s.length) + s;
const htmlYear: (d: Date) => string = d =>
	`${ensurePad(d.getUTCFullYear().toString(), 4, '0')}`;
// yes, there is both htmlMonth and htmlMonthString, and
// htmlMonthString includes the year. this, sadly is to spec
const htmlMonth: (d: Date) => string = d =>
	`${ensurePad(d.getUTCMonth().toString(), 2, '0')}`;
const htmlMonthString: (d: Date) => string = d =>
	`${htmlYear(d)}-${htmlMonth(d)}`;
