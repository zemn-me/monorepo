import classNames from "classnames";
import { useEffect, useState } from "react";
import type { z } from "zod";

import style from "#root/project/zemn.me/components/InlineLogin/inline_login.module.css";
import { ProgressCircle } from "#root/project/zemn.me/components/ProgressCircle/ProgressCircle.js";
import { usePosterDisplayName } from "#root/project/zemn.me/hook/usePosterDisplayName.js";
import { useZemnMeAuth } from "#root/project/zemn.me/hook/useZemnMeAuth.js";
import { future_and_then, future_error, future_flatten_then, future_resolve } from "#root/ts/future/future.js";
import { OidcIdTokenClaimsSchema } from "#root/ts/oidc/id_token.js";
import { background } from "#root/ts/promise/ignore_result.js";

	const progressRatio = (
		min: number, max: number, now: number
	) => {
		const range = max - min;
		const norm = now - min;
		return norm / range;
	}


interface TimeLeftIndicatorProps {
	readonly start: Date;
	readonly end: Date;
}

function TimeLeftIndicator(
	{ start, end }: TimeLeftIndicatorProps
) {
	const [now, setNow] = useState(Date.now());

	useEffect(
		() => {
			const interval = setInterval(
				() => setNow(Date.now()),
				1000
			);
			return () => clearInterval(interval);
		}
	)

	const done = now >= end.getTime();
	const progress = progressRatio(
		start.getTime(),
		end.getTime(),
		+now,
	)
	const clampedProgress = Math.min(1, Math.max(0, progress));

	return <ProgressCircle className={style.indicator} loss progress={
		done ? 1 : clampedProgress
	} />
}

type OidcIdTokenClaims = z.infer<typeof OidcIdTokenClaimsSchema>;

function InlineLoginContent({ claims }: { readonly claims: OidcIdTokenClaims }) {
	const displayName = usePosterDisplayName({
		email_address: claims.email,
		given_name: claims.given_name,
		family_name: claims.family_name,
		sub: claims.sub,
	});

	return displayName
		? <span className={style.loggedIn}>
			{claims.picture
				? <img
					alt={`${displayName} profile picture`}
					className={style.profilePicture}
					src={claims.picture}
				/>
				: undefined}
			<span className={style.loggedInText}>Logged in as <i>{displayName}</i></span>
			<sup><TimeLeftIndicator
			end={new Date(claims.exp * 1000)}
			start={new Date(claims.iat * 1000)}
			/></sup >.
		</span>
		: <>Logged in.</>;
}


export function InlineLogin() {
	const [fut_idToken, , fut_promptForLogin] = useZemnMeAuth();

	const idTokenData = future_flatten_then(future_and_then(
		fut_idToken,
		tok => {
			// "unsafely" (not really because on client)
			// parse id_token
			const claims = tok.split(".")[1]!;
			const decoded = atob(claims);
			const r = OidcIdTokenClaimsSchema.safeParse(
				JSON.parse(decoded)
			);

			return r.success
				? future_resolve(r.data)
				: future_error(r.error)
		}
	))

	const loginButton = (error: boolean) => <button
		className={
			classNames(
				style.inlineLogin,
				error ? style.error : undefined,
			)
		}
		disabled={fut_promptForLogin(
			() => false, () => true, () => true
		)}
		onClick={fut_promptForLogin(
			p => background(p),
			() => undefined,
			() => undefined,
		)}
	>
		{fut_promptForLogin(
			() => "Log in",
			() => "⌛",
			() => "Log in",
		)}
	</button>;


	return idTokenData(
		f => <InlineLoginContent claims={f} />,
		() => loginButton(false),
		err => {
			// eslint-disable-next-line no-console
			console.error(err);
			return loginButton(true);
		},
	)
}
