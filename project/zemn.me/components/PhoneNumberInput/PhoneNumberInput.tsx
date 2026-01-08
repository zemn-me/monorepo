import { type ChangeEventHandler, type FocusEventHandler, forwardRef, type Ref, useId } from "react";

import { useGetExactContact } from "#root/project/zemn.me/hook/useGetExactContact.js"
import { either } from "#root/ts/either/either.js";
import { displayPersonName } from "#root/ts/google/people/display.js";
import { and_then, flatten } from "#root/ts/option/types.js";


export type PhoneNumberInputProps = {
	readonly name?: string;
	readonly value: string;
	readonly onChange: ChangeEventHandler<HTMLInputElement>;
	readonly onBlur?: FocusEventHandler<HTMLInputElement>;
	readonly disabled?: boolean;
	readonly placeholder?: string;
	readonly id?: string
};

function _PhoneNumberInput(props: PhoneNumberInputProps, ref: Ref<HTMLInputElement>) {
	const backupId = useId();
	const {
		name,
		value,
		onChange,
		onBlur,
		disabled,
		placeholder,
		id = backupId
	} = props;


	const contacts = useGetExactContact(
		"phoneNumbers",
		value,
		new Set([
			"names",
			"nicknames",
		])
	);

	const displayName = flatten(and_then(
		contacts.data,
		person => displayPersonName(person)
	))


	return (
		<span>
			{
				either(
					displayName,
					() => null,
					name =>
						<label htmlFor={id}>({name})</label>,
				)
			}
			<input
				disabled={disabled}
				id={id}
				name={name}
				onBlur={onBlur}
				onChange={onChange}
				placeholder={placeholder}
				ref={ref}
				type="tel"
				value={value}
			/>
		</span>
	);
}


export const PhoneNumberInput = forwardRef(_PhoneNumberInput);
