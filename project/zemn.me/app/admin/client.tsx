"use client";
import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import createClient from "openapi-fetch";
import { useEffect, useId, useState } from "react";
import { useFieldArray, useForm } from 'react-hook-form';
import { z } from "zod";

import type { components, paths } from "#root/project/zemn.me/api/api_client.gen";
import { PendingPip } from "#root/project/zemn.me/components/PendingPip/PendingPip.js";
import { requestOIDC, useOIDC } from "#root/project/zemn.me/hook/useOIDC.js";
import { ID_Token } from "#root/ts/oidc/oidc.js";
import { and_then as option_and_then, flatten as option_flatten, None, Option, option_result_transpose, Some, unwrap_or as option_unwrap_or, unwrap_or_else as option_unwrap_or_else } from "#root/ts/option/types.js";
import { fetchResult } from "#root/ts/result/openapi-fetch/fetchResult.js";
import { queryResult } from "#root/ts/result/react-query/queryResult.js";
import { and_then as result_and_then, flatten, unwrap_or as result_unwrap_or, unwrap_or_else as result_unwrap_or_else } from "#root/ts/result/result.js";
import { e164 } from "#root/ts/zod/e164.js";

const apiClient = (Authorization: string) =>
	createClient<paths>({
		baseUrl: "https://api.zemn.me",
		headers: {
			Authorization
		},
	})


interface SettingsEditorProps {
	readonly Authorization: string
}

type CallboxSettings = components["schemas"]["CallboxSettings"];

const defaultValues = {
	authorizers: [],
	fallbackPhone: "",
	entryCodes: [],
	partyMode: false as boolean | undefined,
}

const phoneNumberSchema = e164;

const authorizerSchema = z.object({
	phoneNumber: phoneNumberSchema,
});

const entryCodeSchema = z.string()
	.regex(
		/^\d{5}$/,
		"Must be a 5 digit number."
	)

const entryCodeEntrySchema = z.object({
	code: entryCodeSchema
})

const settingsSchema = z.object({
	authorizers: authorizerSchema.array(),
	fallbackPhone: phoneNumberSchema,
	entryCodes: entryCodeEntrySchema.array(),
	partyMode: z.boolean().optional(),
})

function maybeMessage(m: string | undefined) {
	if (m === undefined) return null

	return m;
}


function SettingsEditor({ Authorization }: SettingsEditorProps) {
	const idbase = useId();
	const id = (...s: string[]) => [
		idbase, ...s
	].join("/");
	const client = apiClient(Authorization);
	const queryClient = useQueryClient();
	const queryKey = [
		 '/callbox/settings', Authorization
	];

	const remoteSettingsQuery = useQuery({
		queryFn: async () => fetchResult(
			await client.GET('/callbox/settings'),
			({ cause }) => new Error(cause)
		),
		queryKey,
	});

	const remoteSettings = option_and_then(
		queryResult(remoteSettingsQuery),
		r => flatten(r)
	);

	const values = option_unwrap_or(
		option_and_then(
			remoteSettings,
			r => result_unwrap_or(
				r,
				defaultValues
			)
		),
		defaultValues
	)

	const {
		register,
		handleSubmit,
		formState: { errors },
		control
	} = useForm<
		CallboxSettings
	>({
		values,
		shouldUseNativeValidation: true,
		shouldFocusError: true,
		resolver: zodResolver(
			settingsSchema
		)
	});

	const mutateRemoteSettings = useMutation({
		mutationFn: (s: CallboxSettings) => client.POST(
			'/callbox/settings',
			{
				body: s
			},
		),
		onMutate: () => queryClient.invalidateQueries({
			queryKey: queryKey
		})
	});

	const authorizerFields = useFieldArray({
		control, // control props comes from useForm (optional: if you are using FormProvider)
		name: "authorizers", // unique name for your Field Array
	});


	const entryCodesFields = useFieldArray({
		control, // control props comes from useForm (optional: if you are using FormProvider)
		name: "entryCodes", // unique name for your Field Array
	});


	// eslint-disable-next-line @typescript-eslint/no-misused-promises
	return <form onSubmit={handleSubmit(d => { void mutateRemoteSettings.mutate(d) })}>
		<PendingPip value={Some(remoteSettings)} />
		<fieldset>
			<legend>Settings</legend>

			<fieldset>
				<legend>Authorizers</legend>
				<p>These phone numbers can be entered by the vistor like an entry code. Instead of allowing immediate access, they will connect the visitor with the phone number. The person on the other end can press 9 to let the visitor in.</p>

				{
					authorizerFields.fields.map(
						(f, i) => <fieldset>
						<input
							id={f.id}
							key={f.id}
							{...register(
								`authorizers.${i}.phoneNumber`
							)}
						/>

						<button onClick={
							e => {
								e.preventDefault();
								authorizerFields.remove(i)
							}
						}>-</button>

							{
								maybeMessage(errors.authorizers?.[i]?.phoneNumber?.message)
							}
						</fieldset>
					)
				}

				{maybeMessage(
					errors.authorizers?.message
				)}

				<button onClick={
					e => {
						e.preventDefault();
						authorizerFields.append({
							phoneNumber: "+"
						})
					}
				}>+</button>
			</fieldset>
			<fieldset>
				<legend>Entry Codes</legend>

				<p>These codes may be used to directly enter once connected.</p>


				{
					entryCodesFields.fields.map(
					(f, i) => <fieldset>
						<input
							id={f.id}
							key={f.id}
							{...register(
								`entryCodes.${i}.code`
							)}
						/>

						<button onClick={
							e => {
								e.preventDefault();
								entryCodesFields.remove(i)
							}
						}>-</button>

							{
								maybeMessage(
									errors.entryCodes?.[i]?.code?.message
								)
							}
						</fieldset>
				)}

				{maybeMessage(
					errors.entryCodes?.message
				)}
				<button onClick={
					e => {
						e.preventDefault();
						entryCodesFields.append({
							code: "0"
						})
					}
				}>+</button>
			</fieldset>
			<fieldset>
				<legend>Fallback phone number</legend>
				<label htmlFor={id('fallbackPhone')} >
					<p>
						Called if no other entry option is available. As with a regular authorizer, can press 9 to let the visitor in.</p>
				</label>
				<input
					id={id('fallbackPhone')}
					type="tel"
					{
					...register("fallbackPhone")
					}
				/>

				{
					errors.fallbackPhone ?
						<output htmlFor={id('fallbackPhone')}>
							{errors.fallbackPhone.message}
						</output> : null
				}
			</fieldset>
			<fieldset>
				<legend>Party Mode</legend>
				<label htmlFor={id('partyMode')} >
					<p>Whether the callbox is in party mode. In party mode, the callbox will not ask for a code and will instead immediately open the door.</p>
				</label>
				<input
					id={id('partyMode')}
					type="checkbox"
					{
					...register("partyMode")
					}
				/>

				{
					errors.partyMode ?
						<output htmlFor={id('partyMode')}>
							{errors.partyMode.message}
						</output> : null
				}
			</fieldset>
			<input type="submit" />
		</fieldset>
	</form>


}


export default function Admin() {
	const googleAuth = useOIDC((v): v is ID_Token => v.iss == "https://accounts.google.com");
	const authToken = option_and_then(
		googleAuth,
		q => result_and_then(
			q,
			v => v[0] === undefined ? None : Some(v[0])
		)
	);

	const at = result_and_then(option_result_transpose(authToken),
		o => option_flatten(o)
	);

	const [openWindowHnd, setOpenWindowHnd] = useState<Option<WindowProxy>>(None);

	// when googleAuth is something, make sure to close any open window handles
	useEffect(
		() => void result_and_then(
			at,
			r => option_and_then(
				r,
				() => option_and_then(
					openWindowHnd,
					wnd => wnd.close()
				)
			)
		)
		, [at])

	const login_button = result_unwrap_or_else(
		result_and_then(
			at,
			r => option_unwrap_or_else(
				option_and_then(
					r,
					() => <p>You are logged in.</p>
				),
				() => <button onClick={() => setOpenWindowHnd(Some(requestOIDC("https://accounts.google.com")!))}>
					<p>
						You are not authenticated to perform this operation.
					</p>
					<p>
						Please click here to authenticate.
					</p>
				</button>)
		), e => <>error: {e}</>);

	const authTokenOrNothing = option_flatten(result_unwrap_or(result_and_then(
		at,
		v => Some(v)
	), None));

	return <>
		<p>{login_button}</p>
		{option_unwrap_or(option_and_then(
			authTokenOrNothing,
			token => <SettingsEditor Authorization={token}/>
		), null)}
	</>
}
