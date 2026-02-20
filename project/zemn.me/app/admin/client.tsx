'use client';
import { zodResolver } from '@hookform/resolvers/zod';
import { useQueryClient } from '@tanstack/react-query';
import { useEffect, useId, useMemo, useState } from 'react';
import { Controller, useFieldArray, useForm } from 'react-hook-form';
import { z } from 'zod';

import type { components } from '#root/project/zemn.me/api/api_client.gen.js';
import Link from '#root/project/zemn.me/components/Link/index.js';
import { PendingPip } from '#root/project/zemn.me/components/PendingPip/PendingPip.js';
import { PhoneNumberDisplay } from '#root/project/zemn.me/components/PhoneNumberDisplay/PhoneNumberDisplay.js';
import { PhoneNumberInput } from '#root/project/zemn.me/components/PhoneNumberInput/PhoneNumberInput.js';
import {
	useFetchClient,
	useGetAdminUid,
	useInvalidateCallboxLogs,
	useZemnMeApi,
} from '#root/project/zemn.me/hook/useZemnMeApi.js';
import { useZemnMeAuth } from '#root/project/zemn.me/hook/useZemnMeAuth.js';
import { future_to_option } from '#root/ts/future/option/future_to_option.js';
import {
	and_then as option_and_then,
	is_some as option_is_some,
	Some,
	unwrap as option_unwrap,
	unwrap_or as option_unwrap_or,
} from '#root/ts/option/types.js';
import { queryResult } from '#root/ts/result/react-query/queryResult.js';
import {
	and_then as result_and_then,
	Err,
	or_else as result_or_else,
	unwrap_or as result_unwrap_or,
	unwrap_or_else as result_unwrap_or_else,
} from '#root/ts/result/result.js';
import { e164 } from '#root/ts/zod/e164.js';

interface SettingsEditorProps {
	readonly Authorization: string;
}

type CallboxSettings = components['schemas']['CallboxSettings'];
type CallboxLogEntry = components['schemas']['CallboxLogEntry'];
type CallboxLogPage = components['schemas']['CallboxLogPage'];

const defaultValues = {
	authorizers: [],
	fallbackPhone: '',
	entryCodes: [],
	partyMode: false as boolean | undefined,
};

const phoneNumberSchema = e164;

const authorizerSchema = z.object({
	phoneNumber: phoneNumberSchema,
});

const entryCodeSchema = z
	.string()
	.regex(/^\d{5}$/, 'Must be a 5 digit number.');

const entryCodeEntrySchema = z.object({
	code: entryCodeSchema,
});

const settingsSchema = z.object({
	authorizers: authorizerSchema.array(),
	fallbackPhone: phoneNumberSchema,
	entryCodes: entryCodeEntrySchema.array(),
	partyMode: z.boolean().optional(),
});

type NormalizedSettingsSnapshot = {
	authorizers: readonly string[];
	entryCodes: readonly string[];
	fallbackPhone: string;
	partyMode: boolean;
};

const normalizeSettingsSnapshot = (settings: CallboxSettings): NormalizedSettingsSnapshot => {
	const authorizers = Array.isArray(settings.authorizers)
		? settings.authorizers
		: [];
	const entryCodes = Array.isArray(settings.entryCodes)
		? settings.entryCodes
		: [];
	const fallbackPhone =
		typeof settings.fallbackPhone === 'string' ? settings.fallbackPhone : '';

	return {
		authorizers: authorizers.map(({ phoneNumber }) => phoneNumber.trim()),
		entryCodes: entryCodes.map(({ code }) => code.trim()),
		fallbackPhone: fallbackPhone.trim(),
		partyMode: Boolean(settings.partyMode),
	};
};

const settingsSnapshotsEqual = (
	a: NormalizedSettingsSnapshot,
	b: NormalizedSettingsSnapshot,
): boolean =>
	a.fallbackPhone === b.fallbackPhone &&
		a.partyMode === b.partyMode &&
		a.authorizers.length === b.authorizers.length &&
		a.authorizers.every((value, index) => value === b.authorizers[index]) &&
		a.entryCodes.length === b.entryCodes.length &&
		a.entryCodes.every((value, index) => value === b.entryCodes[index]);

function maybeMessage(m: string | undefined) {
	if (m === undefined) return null;

	return m;
}

function formatLogWhen(value: CallboxLogEntry['when']) {
	const date = value instanceof Date ? value : new Date(value);
	if (Number.isNaN(date.getTime())) {
		return String(value);
	}
	return date.toLocaleString();
}

function describeLogEntry(entry: CallboxLogEntry) {
	switch (entry.kind) {
		case 'call_received':
			return {
				details: {
					from: entry.from,
					to: entry.to,
				},
			};
		case 'entry_party_mode':
			return { details: null };
		case 'entry_code_denied':
		case 'entry_code_allowed':
			return {
				details: {
					digits: entry.digits,
				},
			};
		case 'entry_authorizer_dial':
			return {
				details: {
					number: entry.number,
					attempt: entry.attempt,
				},
			};
		case 'entry_authorizer_status':
			return {
				details: {
					status: entry.status,
					attempt: entry.attempt,
				},
			};
		case 'settings_update':
			return {
				details: {
					settings: entry.settings,
				},
			};
		default:
			return { details: entry };
	}
}

function CallboxLog({ Authorization }: { readonly Authorization: string }) {
	const $api = useZemnMeApi(Authorization);
	const fetchClient = useFetchClient(Authorization);
	const logQuery = $api.useQuery('get', '/callbox/logs', {
		headers: { Authorization },
		params: {
			query: {
				limit: 100,
			},
		},
	});
	const [entries, setEntries] = useState<CallboxLogEntry[] | null>(null);
	const [nextCursor, setNextCursor] = useState<string | null>(null);

	useEffect(() => {
		if (logQuery.status !== 'success') return;
		const data = logQuery.data as CallboxLogPage | undefined;
		if (!data) return;
		setEntries(data.items ?? []);
		setNextCursor(data.nextCursor ?? null);
	}, [logQuery.status, logQuery.data]);

	if (logQuery.status === 'pending') {
		return (
			<fieldset>
				<legend>Callbox Log</legend>
				<output>Loading...</output>
			</fieldset>
		);
	}

	if (logQuery.status === 'error') {
		return (
			<fieldset>
				<legend>Callbox Log</legend>
				<details>
					<summary>❌</summary>
					{String(logQuery.error)}
				</details>
			</fieldset>
		);
	}

	const logs = entries ?? [];

	return (
		<fieldset>
			<legend>Callbox Log</legend>
			{logs.length === 0 ? (
				<output>No log entries yet.</output>
			) : (
				<ol>
					{logs.map((entry, index) => {
						const { details } = describeLogEntry(entry);
						const detailsText =
							details !== null ? JSON.stringify(details, null, 2) : null;
						return (
							<li key={`${entry.id}-${entry.kind}-${index}`}>
								<div>
									<time dateTime={String(entry.when)}>
										{formatLogWhen(entry.when)}
									</time>{' '}
									<code>{entry.kind}</code> {entry.message}
								</div>
								{detailsText ? (
									<details>
										<summary>Details</summary>
										<pre>{detailsText}</pre>
									</details>
								) : null}
							</li>
						);
					})}
				</ol>
			)}
			{nextCursor ? (
				<button
					onClick={async e => {
						e.preventDefault();
						const resp = await fetchClient.GET('/callbox/logs', {
							params: {
								query: {
									limit: 100,
									cursor: nextCursor,
								},
							},
						});
						if (resp.data) {
							setEntries(prev => [
								...(prev ?? []),
								...(resp.data.items ?? []),
							]);
							setNextCursor(resp.data.nextCursor ?? null);
						}
					}}
				>
					Load more
				</button>
			) : null}
		</fieldset>
	);
}

function SettingsEditor({ Authorization }: SettingsEditorProps) {
	const $api = useZemnMeApi(Authorization);
	const idbase = useId();
	const id = (...s: string[]) => [idbase, ...s].join('/');

	const queryClient = useQueryClient();
	const invalidateCallboxLogs = useInvalidateCallboxLogs();

	const remoteSettingsParams = [
		'get',
		'/callbox/settings',
		{
			headers: {
				Authorization,
			},
		},
	] as const;

	const remoteSettingsKey = remoteSettingsParams;

	const remoteSettingsQuery = $api.useQuery(...remoteSettingsParams);

	const remoteSettings = option_and_then(
		queryResult(remoteSettingsQuery),
		r => result_or_else(r, ({ cause }) => Err(new Error(cause)))
	);

	const remoteSettingsSnapshot = useMemo(
		() =>
			remoteSettingsQuery.data
				? normalizeSettingsSnapshot(remoteSettingsQuery.data)
				: null,
		[remoteSettingsQuery.data]
	);

	const [lastSubmittedSnapshot, setLastSubmittedSnapshot] = useState<
		NormalizedSettingsSnapshot | null
	>(null);

	const values = option_unwrap_or(
		option_and_then(remoteSettings, r =>
			result_unwrap_or(r, defaultValues)
		),
		defaultValues
	);

	const {
		register,
		handleSubmit,
		formState: { errors },
		control,
	} = useForm<CallboxSettings>({
		values,
		shouldUseNativeValidation: true,
		shouldFocusError: true,
		resolver: zodResolver(settingsSchema),
	});

	const mutateRemoteSettings = $api.useMutation('post', '/callbox/settings', {
		onSuccess: () => {
			void queryClient.invalidateQueries({
				queryKey: remoteSettingsKey,
			});
			invalidateCallboxLogs();
		},
	});
	const authorizerFields = useFieldArray({
		control, // control props comes from useForm (optional: if you are using FormProvider)
		name: 'authorizers', // unique name for your Field Array
	});

	const entryCodesFields = useFieldArray({
		control, // control props comes from useForm (optional: if you are using FormProvider)
		name: 'entryCodes', // unique name for your Field Array
	});


	const syncStatus: 'loading' | 'saving' | 'waiting' | 'error' | 'synced' =
		(() => {
			if (
				remoteSettingsQuery.status === 'error' ||
				mutateRemoteSettings.status === 'error'
			) {
				return 'error';
			}
			if (remoteSettingsQuery.status === 'pending') {
				return 'loading';
			}
			if (mutateRemoteSettings.status === 'pending') {
				return 'saving';
			}
			if (
				lastSubmittedSnapshot !== null &&
				remoteSettingsSnapshot !== null
			) {
				return settingsSnapshotsEqual(
					lastSubmittedSnapshot,
					remoteSettingsSnapshot
				)
					? 'synced'
					: 'waiting';
			}
			if (lastSubmittedSnapshot !== null) {
				return 'waiting';
			}
			return 'synced';
		})();

	const ariaBusy =
		syncStatus === 'loading' ||
		syncStatus === 'saving' ||
		syncStatus === 'waiting'
			? 'true'
			: 'false';

	return (
		<form
			// eslint-disable-next-line @typescript-eslint/no-misused-promises
			onSubmit={handleSubmit(d => {
				setLastSubmittedSnapshot(normalizeSettingsSnapshot(d));
				void mutateRemoteSettings.mutate({
					headers: {
						Authorization: Authorization,
					},
					body: d,
				});
			})}
		>
			<fieldset>
				<legend>Settings</legend>

				<fieldset>
					<legend>Authorizers</legend>
					<p>
						These phone numbers can be entered by the vistor like an
						entry code. Instead of allowing immediate access, they
						will connect the visitor with the phone number. The
						person on the other end can press 9 to let the visitor
						in.
					</p>

					{authorizerFields.fields.map((f, i) => (
						<fieldset key={f.id}>
							<Controller
								control={control}
								{...register(`authorizers.${i}.phoneNumber`)}
								render={({ field: { name, onChange, onBlur, value, ref } }) => <PhoneNumberInput
									name={name}
									onBlur={onBlur}
									onChange={onChange}
									ref={ref}
									value={value}
								/>}
							/>

							<button
								onClick={e => {
									e.preventDefault();
									authorizerFields.remove(i);
								}}
							>
								-
							</button>

							{maybeMessage(
								errors.authorizers?.[i]?.phoneNumber?.message
							)}
						</fieldset>
					))}

					{maybeMessage(errors.authorizers?.message)}

					<button
						onClick={e => {
							e.preventDefault();
							authorizerFields.append({
								phoneNumber: '+',
							});
						}}
					>
						+
					</button>
				</fieldset>
				<fieldset>
					<legend>Entry Codes</legend>

					<p>
						These codes may be used to directly enter once
						connected.
					</p>

					{entryCodesFields.fields.map((f, i) => (
						<fieldset key={f.id}>
							<input
								id={f.id}
								key={f.id}
								{...register(`entryCodes.${i}.code`)}
							/>

							<button
								onClick={e => {
									e.preventDefault();
									entryCodesFields.remove(i);
								}}
							>
								-
							</button>

							{maybeMessage(
								errors.entryCodes?.[i]?.code?.message
							)}
						</fieldset>
					))}

					{maybeMessage(errors.entryCodes?.message)}
					<button
						onClick={e => {
							e.preventDefault();
							entryCodesFields.append({
								code: '0',
							});
						}}
					>
						+
					</button>
				</fieldset>
				<fieldset>
					<legend>Fallback phone number</legend>
					<label htmlFor={id('fallbackPhone')}>
						<p>
							Called if no other entry option is available. As
							with a regular authorizer, can press 9 to let the
							visitor in.
						</p>
					</label>
					<Controller
						control={control}
						{...register(`fallbackPhone`)}
						render={({ field: { name, onChange, onBlur, value, ref } }) => <PhoneNumberInput
							id={id('fallbackPhone')}
							name={name}
							onBlur={onBlur}
							onChange={onChange}
							ref={ref}
							value={value}
						/>}
					/>

					{errors.fallbackPhone ? (
						<output htmlFor={id('fallbackPhone')}>
							{errors.fallbackPhone.message}
						</output>
					) : null}
				</fieldset>
				<fieldset>
					<legend>Party Mode</legend>
					<label htmlFor={id('partyMode')}>
						<p>
							Whether the callbox is in party mode. In party mode,
							the callbox will not ask for a code and will instead
							immediately open the door. The fallback phone number
							will receive a text when party mode is used.
						</p>
					</label>
					<input
						id={id('partyMode')}
						type="checkbox"
						{...register('partyMode')}
					/>

					{errors.partyMode ? (
						<output htmlFor={id('partyMode')}>
							{errors.partyMode.message}
						</output>
					) : null}
				</fieldset>
				<input type="submit" />
				<output
					aria-atomic="true"
					aria-busy={ariaBusy}
					aria-label="Callbox settings status"
					aria-live="polite"
					role="status"
				>
					Sync status: {syncStatus}
				</output>
				<PendingPip value={Some(remoteSettings)} />
			</fieldset>
		</form>
	);
}

function DisplayPhoneNumber({
	Authorization,
}: {
	readonly Authorization: string;
}) {
	const $api = useZemnMeApi();
	const pn = queryResult(
		$api.useQuery('get', '/phone/number', {
			headers: { Authorization },
		})
	);

	const el = option_and_then(pn, r =>
		result_unwrap_or_else(
			result_and_then(r, ({ phoneNumber }) => (
				<Link href={`tel:${phoneNumber}`}>
					<PhoneNumberDisplay number={phoneNumber}/>
				</Link>
			)),
			({ cause }) => (
				<details>
					<summary>❌</summary>
					{cause}
				</details>
			)
		)
	);

	return (
		<fieldset>
			<legend>Phone Number</legend>
			<output>{option_unwrap_or(el, <>⏳</>)}</output>
		</fieldset>
	);
}

function DisplayAdminUid({
	Authorization,
}: {
	readonly Authorization: string;
}) {
	const uidQuery = useGetAdminUid(Authorization);
	const uid = queryResult(uidQuery);

	const el = option_and_then(uid, r =>
		result_unwrap_or_else(
			result_and_then(r, u => <code>{u}</code>),
			e => (
				<details>
					<summary>❌</summary>
					{e.toString()}
				</details>
			)
		)
	);

	return (
		<fieldset>
			<legend>UID</legend>
			<output aria-label="Admin UID value">{option_unwrap_or(el, <>⏳</>)}</output>
		</fieldset>
	);
}

export default function Admin() {
	const [fut_idToken, , fut_promptForLogin] = useZemnMeAuth();
	const idToken = future_to_option(fut_idToken);
	const promptForLogin = future_to_option(fut_promptForLogin);
	const loginReady = option_is_some(promptForLogin);

	const handleLogin = () => {
		if (!loginReady) return;
		const beginLogin = option_unwrap(promptForLogin);
		void beginLogin();
	};

	const login = (
		<div>
			<button
				aria-label="Authenticate with OIDC"
				disabled={!loginReady}
				onClick={handleLogin}
			>
				<p>You are not authenticated to perform this operation.</p>
				<p>Please click here to authenticate.</p>
			</button>
		</div>
	);

	return option_unwrap_or(
		option_and_then(idToken, Authorization => (
			<>
				<p>You are logged in.</p>
				<DisplayAdminUid Authorization={Authorization} />
				<DisplayPhoneNumber Authorization={Authorization} />
				<SettingsEditor Authorization={Authorization} />
				<CallboxLog Authorization={Authorization} />
			</>
		)),
		login
	);
}
