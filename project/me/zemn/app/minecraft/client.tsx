'use client';

import {
	faCheck,
	faCopy,
	faServer,
	faTerminal,
	faTriangleExclamation,
	faUserPlus,
} from '@fortawesome/free-solid-svg-icons';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { FormEvent, useEffect, useMemo, useRef, useState } from 'react';
import style from '#root/project/me/zemn/app/minecraft/style.module.css';
import {
	type MinecraftEventStreamState,
	type MinecraftLogEvent,
	useGetMeScopes,
	useGetMinecraftStatus,
	useGetMinecraftWhitelist,
	useMinecraftEvents,
	usePostMinecraftWake,
	usePutMinecraftWhitelist,
} from '#root/project/me/zemn/hook/useZemnMeApi.js';
import { useZemnMeAuth } from '#root/project/me/zemn/hook/useZemnMeAuth.js';
import {
	type Future,
	future_error,
	future_loading,
	future_resolve,
} from '#root/ts/future/future.js';

const minecraftScope = 'minecraft';
const serverAddress = 'zemn.me';
const minecraftUsernamePattern = /^[A-Za-z0-9_]{3,16}$/;

type MinecraftStatus = ReturnType<
	typeof useGetMinecraftStatus
> extends Future<infer Value, unknown, unknown>
	? Value
	: never;

type MinecraftWake = Pick<
	ReturnType<typeof usePostMinecraftWake>,
	'isError' | 'isPending' | 'isSuccess'
>;

function usernameError(username: string): string | undefined {
	if (username === '') return undefined;
	if (minecraftUsernamePattern.test(username)) return undefined;
	return 'Use 3-16 letters, numbers, or underscores.';
}

function errorMessage(error: unknown, fallback: string): string {
	if (error instanceof Error) return error.message;
	return fallback;
}

function serverIsOnline(value: MinecraftStatus): boolean {
	return value.rconReachable || value.serverState === 'online';
}

function playerCountLabel(value: MinecraftStatus, online: boolean): string {
	if (!online) return 'server offline';
	if (value.maxPlayers !== undefined) {
		return `of ${value.maxPlayers} online`;
	}
	return 'players online';
}

function wakeStatusNote(
	status: ReturnType<typeof useGetMinecraftStatus>,
	wakeServer: MinecraftWake
): string | undefined {
	return status(
		value => {
			if (serverIsOnline(value)) return undefined;
			if (wakeServer.isError) return 'Wake-up unavailable';
			if (wakeServer.isPending) return 'Sending wake-up';
			if (wakeServer.isSuccess) return 'Wake-up sent';
			return 'Offline';
		},
		() => undefined,
		() => undefined
	);
}

function firstAvailableToken(
	futures: readonly Future<string, void, Error>[]
): Future<string, void, Error> {
	const values: string[] = [];
	const errors: Error[] = [];
	let loading = false;

	for (const future of futures) {
		future(
			value => values.push(value),
			() => {
				loading = true;
			},
			error => errors.push(error)
		);
	}

	if (values.length > 0) {
		return future_resolve(values[0]!);
	}
	if (loading) {
		return future_loading(undefined);
	}
	return future_error(errors[0] ?? new Error('missing login token'));
}

function PlayerCount({
	status,
	wakeServer,
}: {
	readonly status: ReturnType<typeof useGetMinecraftStatus>;
	readonly wakeServer: MinecraftWake;
}) {
	return status(
		value => {
			const online = serverIsOnline(value);
			const label = playerCountLabel(value, online);
			const note = wakeStatusNote(status, wakeServer);
			let visiblePlayers = 0;
			if (online) {
				visiblePlayers = value.onlinePlayers;
			}

			return (
				<div className={style.statBlock}>
					<span className={style.statValue}>{visiblePlayers}</span>
					<span className={style.statLabel}>{label}</span>
					{note !== undefined && (
						<span className={style.statusNote}>
							<FontAwesomeIcon icon={faTriangleExclamation} />
							{note}
						</span>
					)}
				</div>
			);
		},
		() => (
			<div className={style.statBlock}>
				<span className={style.statValue}>...</span>
				<span className={style.statLabel}>checking server</span>
			</div>
		),
		() => (
			<div className={style.statBlock}>
				<span className={style.statValue}>0</span>
				<span className={style.statLabel}>status unavailable</span>
			</div>
		)
	);
}

function eventTimeLabel(timestamp: string): string {
	const date = new Date(timestamp);
	if (Number.isNaN(date.getTime())) return '';
	return new Intl.DateTimeFormat(undefined, {
		hour: '2-digit',
		minute: '2-digit',
		second: '2-digit',
	}).format(date);
}

function streamStateLabel(state: MinecraftEventStreamState): string {
	switch (state) {
		case 'open':
			return 'connected';
		case 'connecting':
			return 'connecting';
		case 'error':
			return 'reconnecting';
		case 'closed':
			return 'closed';
	}
}

function MinecraftEventLog({
	events,
	streamState,
}: {
	readonly events: readonly MinecraftLogEvent[];
	readonly streamState: MinecraftEventStreamState;
}) {
	return (
		<section className={style.eventPanel} aria-label="Minecraft server events">
			<div className={style.eventHeader}>
				<FontAwesomeIcon icon={faTerminal} />
				<h2>Server events</h2>
				<span>{streamStateLabel(streamState)}</span>
			</div>
			{events.length === 0 ? (
				<p className={style.emptyEvents}>Waiting for server events</p>
			) : (
				<ol className={style.eventList}>
					{events.map(event => (
						<li key={event.id}>
							<time dateTime={event.timestamp}>
								{eventTimeLabel(event.timestamp)}
							</time>
							<code>{event.message}</code>
						</li>
					))}
				</ol>
			)}
		</section>
	);
}

export default function MinecraftPageClient() {
	const [fut_googleIdToken, , fut_googlePromptForLogin] =
		useZemnMeAuth('google');
	const [fut_discordIdToken, , fut_discordPromptForLogin] =
		useZemnMeAuth('discord');
	const fut_idToken = firstAvailableToken([
		fut_googleIdToken,
		fut_discordIdToken,
	]);
	const fut_scopes = useGetMeScopes(fut_idToken);
	const status = useGetMinecraftStatus(fut_idToken);
	const whitelist = useGetMinecraftWhitelist(fut_idToken);
	const [username, setUsername] = useState('');
	const [copied, setCopied] = useState(false);
	const wakeStarted = useRef(false);

	const wakeServer = usePostMinecraftWake(fut_idToken);
	const updateWhitelist = usePutMinecraftWhitelist(fut_idToken);

	const remoteUsername = whitelist(
		value => value.username ?? '',
		() => '',
		() => ''
	);

	useEffect(() => {
		setUsername(remoteUsername);
	}, [remoteUsername]);

	const validationError = useMemo(() => usernameError(username), [username]);
	const trimmedUsername = username.trim();
	const saved =
		updateWhitelist.isSuccess &&
		updateWhitelist.data?.username === trimmedUsername;
	const saveError = updateWhitelist.isError
		? errorMessage(
				updateWhitelist.error,
				'Could not update the whitelist.'
			)
		: undefined;
	const hasMinecraftScope = fut_scopes(
		scopes => scopes.includes(minecraftScope),
		() => false,
		() => false
	);
	const eventStream = useMinecraftEvents(fut_idToken, hasMinecraftScope);

	useEffect(() => {
		if (!hasMinecraftScope || wakeStarted.current) return;
		wakeStarted.current = true;
		wakeServer.mutate();
	}, [hasMinecraftScope, wakeServer]);

	const googleLoginButton = fut_googlePromptForLogin(
		promptForLogin => (
			<button
				aria-label="Authenticate with OIDC"
				className={style.primaryButton}
				onClick={() => {
					void promptForLogin();
				}}
				type="button"
			>
				Login with Google
			</button>
		),
		() => (
			<button
				aria-label="Authenticate with OIDC"
				className={style.primaryButton}
				disabled
				type="button"
			>
				Login with Google
			</button>
		),
		() => (
			<button
				aria-label="Authenticate with OIDC"
				className={style.primaryButton}
				disabled
				type="button"
			>
				Login with Google
			</button>
		)
	);
	const discordLoginButton = fut_discordPromptForLogin(
		promptForLogin => (
			<button
				aria-label="Authenticate with Discord"
				className={style.primaryButton}
				onClick={() => {
					void promptForLogin();
				}}
				type="button"
			>
				Login with Discord
			</button>
		),
		() => (
			<button
				aria-label="Authenticate with Discord"
				className={style.primaryButton}
				disabled
				type="button"
			>
				Login with Discord
			</button>
		),
		() => (
			<button
				aria-label="Authenticate with Discord"
				className={style.primaryButton}
				disabled
				type="button"
			>
				Login with Discord
			</button>
		)
	);
	const loginPanel = (
		<main className={style.root}>
			{discordLoginButton}
			{googleLoginButton}
		</main>
	);

	const accessPanel = (
		<main className={style.root}>
			<section className={style.accessPanel}>
				<FontAwesomeIcon icon={faTriangleExclamation} />
				<p>Minecraft access is not enabled for this account.</p>
			</section>
		</main>
	);

	const submit = (event: FormEvent<HTMLFormElement>) => {
		event.preventDefault();
		const error = usernameError(trimmedUsername);
		if (error !== undefined || trimmedUsername === '') {
			return;
		}
		updateWhitelist.mutate(trimmedUsername);
	};

	const minecraftPanel = (
		<main className={style.root}>
			<section className={style.headerBand}>
				<div className={style.blockScene} aria-hidden="true" />
				<div className={style.headerCopy}>
					<h1>Minecraft</h1>
					<p>{serverAddress}</p>
				</div>
			</section>

			<section className={style.statusGrid} aria-label="Server status">
				<div className={style.statusPanel}>
					<FontAwesomeIcon className={style.panelIcon} icon={faServer} />
					<PlayerCount
						status={status}
						wakeServer={wakeServer}
					/>
				</div>
				<div className={style.joinPanel}>
					<button
						className={style.primaryButton}
						onClick={() => {
							void navigator.clipboard
								.writeText(serverAddress)
								.then(() => {
									setCopied(true);
									window.setTimeout(
										() => setCopied(false),
										1800
									);
								});
						}}
						type="button"
					>
						<FontAwesomeIcon icon={copied ? faCheck : faCopy} />
						{copied ? 'Copied' : 'Copy server address'}
					</button>
				</div>
			</section>

			<MinecraftEventLog
				events={eventStream.events}
				streamState={eventStream.streamState}
			/>

			<form className={style.whitelistForm} onSubmit={submit}>
				<fieldset>
					<legend>Whitelist</legend>
					<label htmlFor="minecraft-username">Minecraft username</label>
					<div className={style.inputRow}>
						<input
							autoCapitalize="off"
							autoComplete="off"
							autoCorrect="off"
							id="minecraft-username"
							maxLength={16}
							minLength={3}
							onChange={event => {
								updateWhitelist.reset();
								setUsername(event.currentTarget.value);
							}}
							pattern="[A-Za-z0-9_]{3,16}"
							spellCheck={false}
							value={username}
						/>
						<button
							className={style.iconButton}
							disabled={
								updateWhitelist.isPending ||
								trimmedUsername === '' ||
								validationError !== undefined
							}
							type="submit"
						>
							<FontAwesomeIcon icon={saved ? faCheck : faUserPlus} />
							<span>{saved ? 'Saved' : 'Save'}</span>
						</button>
					</div>
					{validationError !== undefined ? (
						<output htmlFor="minecraft-username">
							{validationError}
						</output>
					) : saveError !== undefined ? (
						<output htmlFor="minecraft-username">{saveError}</output>
					) : null}
				</fieldset>
			</form>
		</main>
	);

	return fut_idToken(
		() => (hasMinecraftScope ? minecraftPanel : accessPanel),
		() => loginPanel,
		() => loginPanel
	);
}
