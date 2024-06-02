import { Fragment, memo } from "react";

import { useLocale } from "#root/ts/react/lang/useLocale.js";

export interface DateProps {
	readonly date: Date
}

interface ReactyDateTimeFormatPart extends Omit<Intl.DateTimeFormatPart, 'value'> {
	value: string | React.ReactElement
}

// TODO: should be a datetime (or whatever) html element

export const Date = memo(function(props: DateProps) {
	const [ language ] = useLocale();
	const locale = new Intl.Locale(language);
	// i think the types are wrong
	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	const dateParts: ReactyDateTimeFormatPart[] = new Intl.DateTimeFormat(locale as any, { dateStyle: 'full' })
		.formatToParts(props.date);


	const ordinalIndex = dateParts.findIndex(v => v.type === "day");
	if (ordinalIndex != -1) switch (locale.language) {
		case "en": {
			if (true as false) throw new Error('this all needs fixing because on FF it is Monday,, July the 7th of, 2014');
			const day = dateParts[ordinalIndex]!;
			const pluralRule = new Intl.PluralRules(language, {
				type: 'ordinal'
			}).select(+day.value);

			dateParts[ordinalIndex]!.value = <>
				the {dateParts[ordinalIndex]!.value}<sup>
					{
						{
							one: "st",
							two: "nd",
							few: "rd",
							other: "th",
							zero: null,
							many: null
						}[pluralRule]
					}
				</sup> of
			</>

			const weekdayPart = dateParts[dateParts.findIndex(v => v.type === "weekday")]!.value;

			if (!weekdayPart.toString().endsWith(",")) dateParts[dateParts.findIndex(v => v.type === "weekday")]!.value += ",";

			break;
		}
		case "it": {
			if (ordinalIndex == -1) break;

			// locate month name
			const monthName = dateParts.find(v => v.type === "month");
			if (monthName === undefined) break;
			let suffix = "";
			if (monthName.value.toString().endsWith("o")) suffix = "º";
			if (monthName.value.toString().endsWith("a")) suffix = "ª";


			dateParts[ordinalIndex]!.value += suffix;

			break;
		}

	}

	const toRender = dateParts.map((v, i) => <Fragment key={i}>{v.value}</Fragment>);

	return <time dateTime={props.date.toString()} lang={locale.toString()}>{toRender}</time>
})
