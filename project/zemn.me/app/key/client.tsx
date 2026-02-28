'use client';

import classNames from 'classnames';
import { useEffect, useState } from 'react';
import { Temporal } from 'temporal-polyfill';

import style from '#root/project/zemn.me/app/key/style.module.css';
import { ProgressCircle } from '#root/project/zemn.me/components/ProgressCircle/ProgressCircle.js';
import { useGetMeKeyStatus, useGetMeScopes, usePostMeKey } from '#root/project/zemn.me/hook/useZemnMeApi.js';
import { useZemnMeAuth } from '#root/project/zemn.me/hook/useZemnMeAuth.js';

const requiredScope = "callbox_key";

function progressRatio(min: number, max: number, now: number) {
	const range = max - min;
	const norm = now - min;
	return norm / range;
}

function parseOpenUntil(openUntil: string | undefined): Temporal.ZonedDateTime | undefined {
	if (!openUntil) return undefined;

	try {
		return Temporal.ZonedDateTime.from(openUntil);
	} catch {
		try {
			const instant = Temporal.Instant.from(openUntil);
			return instant.toZonedDateTimeISO(Temporal.Now.zonedDateTimeISO().timeZoneId);
		} catch {
			return undefined;
		}
	}
}

interface OpenTimerProps {
	readonly start: Temporal.ZonedDateTime;
	readonly end: Temporal.ZonedDateTime;
}

function OpenTimer({ start, end }: OpenTimerProps) {
	const [now, setNow] = useState(Date.now());

	useEffect(() => {
		let frame = 0;
		const update = () => {
			setNow(Date.now());
			frame = requestAnimationFrame(update);
		};
		frame = requestAnimationFrame(update);
		return () => cancelAnimationFrame(frame);
	}, []);

	const done = now >= end.epochMilliseconds;
	const progress = progressRatio(
		start.epochMilliseconds,
		end.epochMilliseconds,
		now,
	);
	const clampedProgress = Math.min(1, Math.max(0, progress));

	return (
		<ProgressCircle
			className={style.timerIndicator}
			loss
			progress={done ? 1 : clampedProgress}
		/>
	);
}

export default function KeyPageClient() {
	const [fut_idToken, , fut_promptForLogin] = useZemnMeAuth();
	const fut_scopes = useGetMeScopes(fut_idToken);
	const postKey = usePostMeKey(fut_idToken);
	const doorStatus = useGetMeKeyStatus(fut_idToken);

	const noAuth = () => <button
		aria-label="Authenticate with OIDC"
		disabled={fut_promptForLogin(
			() => false,
			() => true,
			() => true,
		)}
		onClick={fut_promptForLogin(
			v => () => void v(),
			() => undefined,
			() => undefined,
		)}
		>
			Login with OIDC
		</button>

	return fut_idToken(
		() => <section className={style.root}>
			<button
				aria-label="Unlock Door"
				className={classNames(
					style.lockButton,
					doorStatus(
						s => s.open ? style.lockButtonOpen : undefined,
						() => undefined,
						() => undefined
					)
				)}
				disabled={
					fut_scopes(
						scopes => !scopes.includes(requiredScope) ||
							postKey.isPending,
						() => true,
						() => false,
					)
				}

				onClick={() => {
					void postKey.mutate({
						body: { open: true },
					});
				}}

				type="button"
			>
				<span>
					{
						doorStatus(
							status => status.open ? "🔓" : "🔒",
							(/*loading*/) => "⏳",
							(/*error*/) => "⚠️",
						)
					}
				</span>
			</button>
			{
				doorStatus(
					status => {
						if (!status.open) return null;
						const openUntil = parseOpenUntil(status.openUntil);
						const openedAt = parseOpenUntil(status.lastOpenedAt);
						if (openUntil === undefined || openedAt === undefined) return null;

						return (
							<div className={style.timerRow}>
								<OpenTimer end={openUntil} start={openedAt} />
							</div>
						);
					},
					() => null,
					() => null,
				)
			}
			{
				doorStatus(
					status => {
						if (!status.open) {
							return <p className={style.status}>Locked.</p>;
						}

						return null;
					},
					() => <p className={style.status}>Checking lock status…</p>,
					() => <p className={style.status}>Lock status unavailable.</p>,
				)
			}
		</section>,
		noAuth,
		noAuth,
	)


}
