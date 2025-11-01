"use client";
import { zodResolver } from '@hookform/resolvers/zod';
import { useQueryClient } from "@tanstack/react-query";
import { useEffect, useId } from "react";
import { useFieldArray, useForm } from 'react-hook-form';
import { z } from "zod";

import type { components } from "#root/project/zemn.me/api/api_client.gen";
import Link from '#root/project/zemn.me/components/Link/index.js';
import { PendingPip } from "#root/project/zemn.me/components/PendingPip/PendingPip.js";
import { useOIDC } from "#root/project/zemn.me/hook/useOIDC.js";
import { useZemnMeApi } from '#root/project/zemn.me/hook/useZemnMeApi.js';
import { and_then as option_and_then, Some, unwrap_or as option_unwrap_or, unwrap_or_else as option_unwrap_or_else } from "#root/ts/option/types.js";
import { queryResult } from "#root/ts/result/react-query/queryResult.js";
import { and_then as result_and_then, Err, or_else as result_or_else, unwrap_or as result_unwrap_or, unwrap_or_else as result_unwrap_or_else } from "#root/ts/result/result.js";
import { e164 } from "#root/ts/zod/e164.js";


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
	const $api = useZemnMeApi(Authorization);
	const idbase = useId();
	const id = (...s: string[]) => [
		idbase, ...s
	].join("/");

	const queryClient = useQueryClient();

	const remoteSettingsParams = [
		"get",
		"/callbox/settings",
		{
			headers: {
				Authorization
			}
		},
	] as const;

	const remoteSettingsKey = remoteSettingsParams;

	const remoteSettings =
		option_and_then(
			queryResult($api.useQuery(...remoteSettingsParams)),
			r => result_or_else(
				r,
				({ cause }) => Err(new Error(cause))
			)
		)


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

	const mutateRemoteSettings = $api.useMutation("post", "/callbox/settings", {
		onSuccess: () => {
			void queryClient.invalidateQueries({
				queryKey: remoteSettingsKey
			});
		}
	})
		;



	const authorizerFields = useFieldArray({
		control, // control props comes from useForm (optional: if you are using FormProvider)
		name: "authorizers", // unique name for your Field Array
	});


	const entryCodesFields = useFieldArray({
		control, // control props comes from useForm (optional: if you are using FormProvider)
		name: "entryCodes", // unique name for your Field Array
	});


	// eslint-disable-next-line @typescript-eslint/no-misused-promises
	return <form onSubmit={handleSubmit(d => {
		void mutateRemoteSettings.mutate({
			headers: {
				Authorization: Authorization,
			},
			body: d,
		})
	})}>
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
			<PendingPip value={Some(remoteSettings)} />
		</fieldset>
	</form>


}

function DisplayPhoneNumber({ Authorization }: { readonly Authorization: string }) {
	const $api = useZemnMeApi();
	const pn = queryResult($api.useQuery(
		"get",
		"/phone/number",
		{
			headers: { Authorization }
		}
	));

	const el = option_and_then(
		pn,
		r => result_unwrap_or_else(
			result_and_then(
				r,
				({ phoneNumber }) => <Link href={`tel:${phoneNumber}`}>{phoneNumber}</Link>
			),
			({ cause }) => <details>
				<summary>❌</summary>
				{cause}
			</details>
	));

	return <fieldset>
		<legend>Phone Number</legend>
		<output>
			{
				option_unwrap_or(
					el,
					<>⏳</>
				)
			}

		</output>
	</fieldset>
}

function DisplayAdminUid({ Authorization }: { readonly Authorization: string }) {
        const $api = useZemnMeApi();
        const uid = queryResult($api.useQuery(
                "get",
                "/admin/uid",
                {
                        headers: { Authorization }
                }
        ));

        const el = option_and_then(
                uid,
                r => result_unwrap_or_else(
                        result_and_then(
                                r,
                                u => <code>{u}</code>
                        ),
                        ({ cause }) => <details>
                                <summary>❌</summary>
                                {cause}
                        </details>
        ));

        return <fieldset>
                <legend>UID</legend>
                <output>
                        {
                                option_unwrap_or(
                                        el,
                                        <>⏳</>
                                )
                        }

                </output>
        </fieldset>;
}


export default function Admin() {
	const [idToken, requestURL, beginLogin, isAuthenticating] = useOIDC("https://accounts.google.com");

	useEffect(() => {
		if (typeof window !== "undefined") {
			window.__oidcRequestURL = requestURL;
		}
	}, [requestURL]);

	const isAuthenticated = idToken !== null;

	const loginButton = isAuthenticated ? (
		<p>You are logged in.</p>
	) : (
		<button
			data-request-url={requestURL}
			data-testid="oidc-login-button"
			disabled={!requestURL || isAuthenticating}
			onClick={() => {
				if (!requestURL) return;
				void beginLogin();
			}}
		>
			<p>You are not authenticated to perform this operation.</p>
			<p>Please click here to authenticate.</p>
		</button>
	);

	return (
		<>
			<p>{loginButton}</p>
			{isAuthenticated && idToken ? (
				<>
					<DisplayAdminUid Authorization={idToken} />
					<DisplayPhoneNumber Authorization={idToken} />
					<SettingsEditor Authorization={idToken} />
				</>
			) : null}
		</>
	);
}
