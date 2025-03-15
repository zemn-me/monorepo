"use client";
import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import createClient from "openapi-fetch";
import { useEffect, useId, useState } from "react";
import { useForm } from 'react-hook-form';
import { z } from "zod";

import { requestOIDC, useOIDC } from "#root/project/zemn.me/app/hook/useOIDC.js";
import Link from "#root/project/zemn.me/components/Link/index.js";
import { PendingPip } from "#root/project/zemn.me/components/PendingPip/PendingPip.js";
import { ID_Token } from "#root/ts/oidc/oidc.js";
import { and_then as option_and_then, flatten as option_flatten, is_none, None, Option, option_result_transpose, Some, unwrap_or as option_unwrap_or, unwrap_or_else as option_unwrap_or_else, unwrap_unchecked as option_unwrap_unchecked } from "#root/ts/option/types.js";
import type { components, paths } from "#root/ts/pulumi/zemn.me/api/api_client.gen";
import { fetchResult } from "#root/ts/result/openapi-fetch/fetchResult.js";
import { queryResult } from "#root/ts/result/react-query/queryResult.js";
import { and_then as result_and_then, flatten, is_err, unwrap_err_unchecked, unwrap_or as result_unwrap_or, unwrap_or_else as result_unwrap_or_else, unwrap_unchecked as result_unwrap_unchecked } from "#root/ts/result/result.js";
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
	entryCodes: []
}

const phoneNumberSchema = e164;

const settingsSchema = z.object({
	authorizers: phoneNumberSchema.array(),
	fallbackPhone: phoneNumberSchema,
	entryCodes: phoneNumberSchema.array(),
})

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

	const { register, handleSubmit,
		formState: { errors }} = useForm<
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





	// eslint-disable-next-line @typescript-eslint/no-misused-promises
	return <form onSubmit={handleSubmit(d => { void mutateRemoteSettings.mutate(d) })}>
		<PendingPip value={Some(remoteSettings)} />
		<fieldset>
			<legend>Settings</legend>

			<fieldset>
				<legend>Authorizers</legend>
				<label htmlFor={id('authorizers')}>
					<p>These phone numbers can be entered by the vistor like an entry code. Instead of allowing immediate access, they will connect the visitor with the phone number. The person on the other end can press 9 to let the visitor in.</p>
				</label>
				<input
					id={id('authorizers')}
					{...register(
						'authorizers', {
						setValueAs:
							v => v.split(";")
					}
					)}
				/>
				{
					errors.authorizers ?
						<output htmlFor={id('authorizers')}>
							{errors.authorizers.message}
						</output> : null
				}
			</fieldset>
			<fieldset>
				<legend>Entry Codes</legend>
				<label htmlFor={id('entryCodes')}>
					<p>These codes may be used to directly enter once connected.</p>
				</label>


				<input
					id={id('entryCodes')}
					{...register(
						'entryCodes', {
						setValueAs:
							v => v.split(";")
					}
					)}
				/>

				{
					errors.entryCodes ?
						<output htmlFor={id('entryCodes')}>
							{errors.entryCodes.message}
						</output> : null
				}
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

	const authTokenCacheKey = result_unwrap_or(result_and_then(
		at,
		o => option_unwrap_or(option_and_then(
			o,
			o => o
		), undefined)
	), undefined);

	const phoneNumber = useQuery({
		queryKey: ['callbox', 'phone number', authTokenCacheKey],
		queryFn: async () => {
			if (is_err(at)) return <>
				⚠ {unwrap_err_unchecked(at)}
			</>;

			const auth = result_unwrap_unchecked(at);

			if (is_none(auth)) return <>
				You need to log in to see this.
			</>;

			const client = apiClient(option_unwrap_unchecked(auth));

			const { phoneNumber } = await client.GET("/phone/number").then(v => v.data!);

			const pnn = phoneNumber;

			return <>
				Callbox phone number is currently: {" "}
				<Link href={`tel:${pnn}`}>{pnn}</Link>
			</>
		}
	});

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
		{phoneNumber.error !== null ? <p>
			{phoneNumber.error.toString()}
		</p> : null}
		{phoneNumber.data !== undefined ? <p>
			{phoneNumber.data}
		</p> : null}
		{option_unwrap_or(option_and_then(
			authTokenOrNothing,
			token => <SettingsEditor Authorization={token}/>
		), null)}
	</>
}
