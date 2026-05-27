const schemaOrgBaseURL = 'https://schema.org/' as const;

export type SchemaOrgText = string;
export type SchemaOrgURL = URL | string;
export type SchemaOrgDate = Date | string;

export type SchemaOrgDataValue = SchemaOrgDate | SchemaOrgText | SchemaOrgURL;

export interface SchemaOrgItemReference<T extends string> {
	readonly itemType: T;
}

export interface SchemaOrgVocabulary {
	readonly Article: {
		readonly author:
			| SchemaOrgItemReference<'Organization'>
			| SchemaOrgItemReference<'Person'>;
		readonly datePublished: SchemaOrgDate;
		readonly headline: SchemaOrgText;
	};
	readonly Organization: {
		readonly name: SchemaOrgText;
		readonly url: SchemaOrgURL;
	};
	readonly Person: {
		readonly alternateName: SchemaOrgText;
		readonly birthDate: SchemaOrgDate;
		readonly email: SchemaOrgText;
		readonly jobTitle: SchemaOrgText;
		readonly name: SchemaOrgText;
		readonly sameAs: SchemaOrgURL;
		readonly url: SchemaOrgURL;
		readonly worksFor: SchemaOrgItemReference<'Organization'>;
	};
	readonly ProfilePage: {
		readonly mainEntity: SchemaOrgItemReference<'Person'>;
	};
}

export type SchemaOrgItem = Extract<keyof SchemaOrgVocabulary, string>;
export type SchemaOrgItemType<T extends SchemaOrgItem> =
	`${typeof schemaOrgBaseURL}${T}`;
export type SchemaOrgProperty<T extends SchemaOrgItem> = Extract<
	keyof SchemaOrgVocabulary[T],
	string
>;

type ReferencedItemTypes<T> =
	Extract<T, SchemaOrgItemReference<string>> extends
		SchemaOrgItemReference<infer TItem>
		? Extract<TItem, SchemaOrgItem>
		: never;

export type SchemaOrgItemProperty<T extends SchemaOrgItem> = Extract<
	{
		readonly [TProperty in keyof SchemaOrgVocabulary[T]]: [
			ReferencedItemTypes<SchemaOrgVocabulary[T][TProperty]>,
		] extends [never]
			? never
			: TProperty;
	}[keyof SchemaOrgVocabulary[T]],
	string
>;

export type SchemaOrgDataProperty<T extends SchemaOrgItem> = Extract<
	{
		readonly [TProperty in keyof SchemaOrgVocabulary[T]]: [
			Exclude<
				SchemaOrgVocabulary[T][TProperty],
				SchemaOrgItemReference<SchemaOrgItem>
			>,
		] extends [never]
			? never
			: TProperty;
	}[keyof SchemaOrgVocabulary[T]],
	string
>;

export type SchemaOrgDataPropertyValue<
	TItem extends SchemaOrgItem,
	TProperty extends SchemaOrgDataProperty<TItem>,
> = Exclude<
	SchemaOrgVocabulary[TItem][TProperty],
	SchemaOrgItemReference<SchemaOrgItem>
>;

export type MicrodataItemScope<T extends SchemaOrgItem> = {
	readonly itemScope: true;
	readonly itemType: SchemaOrgItemType<T>;
};

export type MicrodataItemProp<
	TItem extends SchemaOrgItem,
	TProperty extends SchemaOrgProperty<TItem>,
> = {
	readonly itemProp: TProperty;
};

export function itemType<T extends SchemaOrgItem>(
	item: T
): SchemaOrgItemType<T> {
	return `${schemaOrgBaseURL}${item}`;
}

export function itemScope<T extends SchemaOrgItem>(
	item: T
): MicrodataItemScope<T> {
	return {
		itemScope: true,
		itemType: itemType(item),
	};
}

export function itemProp<
	TItem extends SchemaOrgItem,
	TProperty extends SchemaOrgProperty<TItem>,
>(
	_item: TItem,
	property: TProperty
): MicrodataItemProp<TItem, TProperty> {
	return { itemProp: property };
}

export function itemPropScope<
	TItem extends SchemaOrgItem,
	TProperty extends SchemaOrgItemProperty<TItem>,
	TValueItem extends ReferencedItemTypes<
		SchemaOrgVocabulary[TItem][TProperty]
	>,
>(
	_parentItem: TItem,
	property: TProperty,
	valueItem: TValueItem
): MicrodataItemProp<TItem, TProperty> & MicrodataItemScope<TValueItem> {
	return {
		...itemProp(_parentItem, property),
		...itemScope(valueItem),
	};
}

function propertyValue(value: unknown): string {
	if (value instanceof Date) return value.toISOString();

	return String(value);
}

export interface DataPropertyProps<
	TItem extends SchemaOrgItem,
	TProperty extends SchemaOrgDataProperty<TItem>,
> {
	readonly item: TItem;
	readonly name: TProperty;
	readonly value: SchemaOrgDataPropertyValue<TItem, TProperty>;
}

export function DataProperty<
	TItem extends SchemaOrgItem,
	TProperty extends SchemaOrgDataProperty<TItem>,
>({ item, name, value }: DataPropertyProps<TItem, TProperty>) {
	return (
		<data
			hidden
			{...itemProp(item, name)}
			value={propertyValue(value)}
		/>
	);
}
