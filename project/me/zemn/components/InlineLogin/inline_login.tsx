import {
	faRepeat,
	faRightFromBracket,
} from '@fortawesome/free-solid-svg-icons';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import classNames from 'classnames';
import { type ReactNode, useEffect, useState } from 'react';
import type { z } from 'zod';
import style from '#root/project/me/zemn/components/InlineLogin/inline_login.module.css';
import { ProgressCircle } from '#root/project/me/zemn/components/ProgressCircle/ProgressCircle.js';
import { useSessionClaims } from '#root/project/me/zemn/hook/server_session.js';
import {
	type PosterIdentity,
	usePosterDisplayName,
} from '#root/project/me/zemn/hook/usePosterDisplayName.js';
import { useZemnMeAuth } from '#root/project/me/zemn/hook/useZemnMeAuth.js';
import type { OidcIdTokenClaimsSchema } from '#root/ts/oidc/id_token.js';
import { background } from '#root/ts/promise/ignore_result.js';

const progressRatio = (min: number, max: number, now: number) => {
	const range = max - min;
	const norm = now - min;
	return norm / range;
};

interface TimeLeftIndicatorProps {
	readonly start: Date;
	readonly end: Date;
}

function TimeLeftIndicator({ start, end }: TimeLeftIndicatorProps) {
	const [now, setNow] = useState(start.getTime());

	useEffect(() => {
		setNow(Date.now());
		const interval = setInterval(() => setNow(Date.now()), 1000);
		return () => clearInterval(interval);
	}, []);

	const done = now >= end.getTime();
	const progress = progressRatio(start.getTime(), end.getTime(), +now);
	const clampedProgress = Math.min(1, Math.max(0, progress));

	return (
		<ProgressCircle
			className={style.indicator}
			loss
			progress={done ? 1 : clampedProgress}
		/>
	);
}

type OidcIdTokenClaims = z.infer<typeof OidcIdTokenClaimsSchema>;

export function PosterDisplayName({
	fallback,
	poster,
}: {
	readonly fallback?: ReactNode;
	readonly poster?: PosterIdentity | null;
}) {
	const displayName = usePosterDisplayName(poster);
	return displayName ? <>{displayName}</> : fallback;
}

function InlineLoginContent({
	claims,
	onLogout,
	onSwitchUser,
}: {
	readonly claims: OidcIdTokenClaims;
	readonly onLogout: () => Promise<void>;
	readonly onSwitchUser: () => Promise<void>;
}) {
	const poster = {
		email_address: claims.email,
		given_name: claims.given_name,
		family_name: claims.family_name,
		sub: claims.sub,
	};
	const displayName = usePosterDisplayName(poster);
	const accountActions = (
		<span aria-label="Account actions" className={style.accountActions}>
			<button
				aria-label="Log out"
				className={style.accountAction}
				onClick={background(onLogout)}
				title="Log out"
				type="button"
			>
				<FontAwesomeIcon icon={faRightFromBracket} />
			</button>
			<button
				aria-label="Switch user"
				className={style.accountAction}
				onClick={background(onSwitchUser)}
				title="Switch user"
				type="button"
			>
				<FontAwesomeIcon icon={faRepeat} />
			</button>
		</span>
	);

	return displayName ? (
		<span className={style.loggedIn}>
			{claims.picture ? (
				<img
					alt={`${displayName} profile picture`}
					className={style.profilePicture}
					src={claims.picture}
				/>
			) : undefined}
			<span className={style.loggedInText}>
				Logged in as <i>{displayName}</i>
			</span>
			<sup>
				<TimeLeftIndicator
					end={new Date(claims.exp * 1000)}
					start={new Date(claims.iat * 1000)}
				/>
			</sup>
			{accountActions}
		</span>
	) : (
		<span className={style.loggedIn}>Logged in. {accountActions}</span>
	);
}

export function InlineLogin() {
	const [fut_idToken, , fut_promptForLogin, sessionControls] =
		useZemnMeAuth();

	const claims = useSessionClaims(fut_idToken);
	const [actionError, setActionError] = useState<{
		retry: () => Promise<void>;
	}>();
	const runAction = (action: () => Promise<void>) => async () => {
		setActionError(undefined);
		try {
			await action();
		} catch {
			setActionError({ retry: action });
		}
	};

	const loginButton = (error: boolean) => (
		<button
			className={classNames(
				style.inlineLogin,
				error ? style.error : undefined
			)}
			disabled={fut_promptForLogin(
				() => false,
				() => true,
				() => true
			)}
			onClick={fut_promptForLogin(
				p => background(p),
				() => undefined,
				() => undefined
			)}
		>
			{fut_promptForLogin(
				() => 'Log in',
				() => '⌛',
				() => 'Log in'
			)}
		</button>
	);

	const account = claims ? (
		<InlineLoginContent
			claims={claims}
			onLogout={runAction(sessionControls.logout)}
			onSwitchUser={runAction(sessionControls.switchUser)}
		/>
	) : (
		fut_idToken(
			() => loginButton(true),
			() => loginButton(false),
			() => loginButton(true)
		)
	);
	return (
		<>
			{account}
			{actionError ? (
				<span role="alert">
					Could not update your login.{' '}
					<button
						onClick={background(runAction(actionError.retry))}
						type="button"
					>
						Try again
					</button>
				</span>
			) : null}
		</>
	);
}
