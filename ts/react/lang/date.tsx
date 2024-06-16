"use client"; // transitive for useLocale
import { memo, ReactElement } from "react";

import { isDefined } from "#root/ts/guard.js";
import { useLocale } from "#root/ts/react/lang/useLocale.js";

export interface DateProps {
	readonly date: Date
}

export const Date = memo(function(props: DateProps) {
	const [ language ] = useLocale();
	let locale = new Intl.Locale(language);
	// if the language is english, defer to british english
	if (locale.language == "en") locale = new Intl.Locale("en-GB");
	// i think the types are wrong
	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	const dateParts = new Intl.DateTimeFormat(locale as any, {
		dateStyle: 'full'
	})
		.formatToParts(props.date);


	const ordinalIndex = dateParts.findIndex(v => v.type === "day");
	let content: ReactElement | undefined;
	if (ordinalIndex != -1) switch (locale.language) {
		case "en": {
			// justification for this is that Chrome and FF differ on how they format en-GB full dates
			// which i would argue are of the format Friday, the 3rd of January 2024, but are instead
			// in Chrome: Friday 3 January 2024
			// in FF: Friday, 3 January 2024

			// decompose date
			const want = ["weekday", "day", "month", "year"] as const;
			type wantT = (typeof want)[number];
			const pieces = new Set(want);

			const fields = new Map(dateParts.map(v => pieces.has(v.type as wantT /* this is literally how sets work */) ? [v.type as wantT, v.value] as const : undefined)
				.filter(isDefined));

			if (fields.size != want.length) break;

			const pluralRule = new Intl.PluralRules(language, {
				type: 'ordinal'
			}).select(+fields.get("day")!);

			content = <>{fields.get("weekday")}, the {fields.get("day")}<sup>{
				{
					one: "st",
					two: "nd",
					few: "rd",
					other: "th",
					zero: null,
					many: null
				}[pluralRule]
			}</sup> of {fields.get("month")} {fields.get("year")}</>;
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

	if (content === undefined) content = <>{dateParts.map(v => v.value).join("")}</>;

	return <time dateTime={props.date.toString()} lang={locale.toString()}>{content}</time>
})
