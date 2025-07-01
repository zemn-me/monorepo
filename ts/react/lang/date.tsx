"use client";

import { CSSProperties, memo, ReactElement } from "react";

import { isDefined } from "#root/ts/guard.js";
import { useLocale } from "#root/ts/react/lang/useLocale.js";

export interface DateProps {
  readonly date: Date;
  readonly className?: string
  readonly style?: CSSProperties
}

/**
 * Choose a concrete locale from a raw language tag. We default plain
 * English (`en`) to British English (`en-GB`).
 */
function selectLocale(language: string): Intl.Locale {
  const base = new Intl.Locale(language);
  return base.language === "en" ? new Intl.Locale("en-GB") : base;
}

/**
 * Return the Intl‑generated parts needed to assemble a full date.
 */
function getDateParts(date: Date, locale: Intl.Locale): Intl.DateTimeFormatPart[] {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return new Intl.DateTimeFormat(locale as any, { dateStyle: "full" }).formatToParts(date);
}

/**
 * Build an English date in the form:
 *   Friday, the 3rd of January 2024
 * (Chrome and Firefox disagree on the default en‑GB format, so we roll our own.)
 */
function formatEnglish(parts: Intl.DateTimeFormatPart[], language: string): ReactElement | undefined {
  const want = ["weekday", "day", "month", "year"] as const;
  type Part = (typeof want)[number];
  const desired = new Set(want);

  const fields = new Map(
    parts
      .map(p => (desired.has(p.type as Part) ? ([p.type as Part, p.value] as const) : undefined))
      .filter(isDefined)
  );

  if (fields.size !== want.length) return undefined;

  const rule = new Intl.PluralRules(language, { type: "ordinal" }).select(+fields.get("day")!);
  const suffix = { one: "st", two: "nd", few: "rd", other: "th", zero: "", many: "" }[rule];

  return (
    <>
      {fields.get("weekday")}, the {fields.get("day")}
      <sup>{suffix}</sup> of {fields.get("month")} {fields.get("year")}
    </>
  );
}

/**
 * Append the correct ordinal marker (º or ª) to the day for Italian dates.
 */
function appendItalianOrdinalMarker(parts: Intl.DateTimeFormatPart[]): void {
  const dayIndex = parts.findIndex(p => p.type === "day");
  if (dayIndex === -1) return;

  const month = parts.find(p => p.type === "month");
  if (!month) return;

  const marker = month.value.endsWith("a") ? "ª" : month.value.endsWith("o") ? "º" : "";
  if (marker) {
    parts[dayIndex] = { ...parts[dayIndex]!, value: parts[dayIndex]!.value + marker };
  }
}

/**
 * Month–year formatter (e.g. «June 2011»).
 * Uses the current locale’s long month name followed by the numeric year.
 */
function formatMonthYear(date: Date, locale: Intl.Locale): string {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return new Intl.DateTimeFormat(locale as any, { month: "long", year: "numeric" }).format(date);
}

/**
 * Full date component (e.g. «Friday, the 3rd of January 2024»).
 */
export const Date = memo(function DateComponent(props: DateProps) {
  const [language] = useLocale();
  const locale = selectLocale(language);
  const parts = getDateParts(props.date, locale);

  let content: ReactElement | undefined;

  switch (locale.language) {
    case "en":
      content = formatEnglish(parts, language);
      break;
    case "it":
      appendItalianOrdinalMarker(parts);
      break;
  }

  if (content === undefined) {
    content = <>{parts.map(p => p.value).join("")}</>;
  }

  return (
    <time className={props.className} dateTime={props.date.toISOString()} lang={locale.toString()} style={props.style}>{content}</time>
  );
});

/**
 * Month–Year component (e.g. «June 2011»).
 */
export const MonthYear = memo(function MonthYearComponent(props: DateProps) {
  const [language] = useLocale();
  const locale = selectLocale(language);
  const text = formatMonthYear(props.date, locale);

  return (
    <time className={props.className} dateTime={props.date.toISOString()} lang={locale.toString()} style={props.style}>{text}</time>
  );
});
