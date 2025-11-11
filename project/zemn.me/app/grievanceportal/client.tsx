'use client';
import { standardSchemaResolver } from '@hookform/resolvers/standard-schema';
import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { Temporal } from 'temporal-polyfill';
import { z } from 'zod';

import type { components } from '#root/project/zemn.me/api/api_client.gen';
import { PendingPip } from '#root/project/zemn.me/components/PendingPip/PendingPip.js';
import { useOIDC } from '#root/project/zemn.me/hook/useOIDC.js';
import {
	useDeleteGrievances,
	useGetGrievances,
	usePostGrievances,
} from '#root/project/zemn.me/hook/useZemnMeApi.js';
import {
	and_then as option_and_then,
	Some,
	is_some as option_is_some,
	unwrap as option_unwrap,
	unwrap_or as option_unwrap_or,
} from '#root/ts/option/types.js';
import { PrettyDateTime } from '#root/ts/react/lang/date.js';
import { queryResult } from '#root/ts/result/react-query/queryResult.js';
import {
	Err,
	or_else as result_or_else,
} from '#root/ts/result/result.js';

import style from './style.module.css';

interface GrievanceEditorProps {
	readonly Authorization: string;
}

type Grievance = components['schemas']['Grievance'];
type NewGrievance = components['schemas']['NewGrievance'];
type GrievanceWithTimeZone = Grievance & { readonly timeZone?: string | null };

function clientTimeZone(): string {
	if (typeof Intl !== 'undefined') {
		const tz = new Intl.DateTimeFormat().resolvedOptions().timeZone;
		if (tz) return tz;
	}
	return Temporal.Now.zonedDateTimeISO().timeZoneId;
}

function makeDefaultGrievance(): NewGrievance {
	return {
		name: '',
		description: '',
		priority: 1,
		timeZone: clientTimeZone(),
	};
}

const severityMap = new Map<number, string>([
	[1, 'Just logging a vibe check 😌'],
	[2, 'A nice hug will sort it 🤗'],
	[3, 'Chai latte & a smile, please ☕️'],
	[4, 'Ruffles required 🥔'],
	[5, 'Let’s go for a walk by the river 🌅'],
	[6, 'Need penguin videos & cuddles 🐧'],
	[7, 'Bring snacks and patience 🍱'],
	[8, 'Steak dinner peace offering 🥩'],
	[9, 'Send me flowers! 💐'],
	[10, 'Flowers + apology letter! 📝💐'],
]);

const grievanceSchema = z.object({
	name: z.string(),
	description: z.string(),
	priority: z.coerce.number<number>().min(1).max(10),
});

/**
 * a noop that runs a promise in the background
 */
function backgroundPromise<A extends unknown[]>(
	f: (...a: A) => Promise<void>
): (...a: A) => void {
	return (...a: A) => void f(...a);
}

function parseCreatedDate(
	created: Grievance['created'],
	timeZone?: string | null
): Temporal.ZonedDateTime {
	const fallbackZone = timeZone ?? Temporal.Now.zonedDateTimeISO().timeZoneId;
	const normalized = created.toString().trim();
	if (!normalized) {
		return Temporal.Now.zonedDateTimeISO(fallbackZone);
	}

	const coerceToZone = (zoned: Temporal.ZonedDateTime): Temporal.ZonedDateTime =>
		timeZone ? zoned.withTimeZone(timeZone) : zoned;

	try {
		return coerceToZone(Temporal.ZonedDateTime.from(normalized));
	} catch {
		try {
			const bracket = normalized.indexOf('[');
			const instantSource =
				bracket >= 0 ? normalized.slice(0, bracket) : normalized;
			const instant = Temporal.Instant.from(instantSource);
			return instant.toZonedDateTimeISO(fallbackZone);
		} catch {
			return Temporal.Now.zonedDateTimeISO(fallbackZone);
		}
	}
}

function GrievanceEditor({ Authorization }: GrievanceEditorProps) {
	const create = usePostGrievances(Authorization);
	const del = useDeleteGrievances(Authorization);
	const grievancesQuery = useGetGrievances(Authorization);
	const grievances = option_and_then(queryResult(grievancesQuery), r =>
		result_or_else(r, e =>
			Err(
				(e as object) instanceof Error
					? (e as Error)
					: new Error(String(e))
			)
		)
	);


	const [cachedGrievances, setCachedGrievances] = useState<Grievance[]>([]);

	useEffect(() => {
		if (grievancesQuery.data) {
			setCachedGrievances(grievancesQuery.data);
		}
	}, [grievancesQuery.data]);

	const renderGrievanceItems = (items: GrievanceWithTimeZone[]) =>
		items
			.slice()
			.sort(
				(a, b) =>
					new Date(b.created).valueOf() -
					new Date(a.created).valueOf()
			)
			.map((g: GrievanceWithTimeZone) => {
				const createdAt = parseCreatedDate(g.created, g.timeZone);
				return (
					<li key={g.id}>
						<strong>{g.name}</strong>
						{' ('}
						{severityMap.get(g.priority) ?? `level ${g.priority}`}
						{')'}
						<p>
							<PrettyDateTime date={createdAt} />
						</p>
						<pre>{g.description}</pre>
						<button
							className={style.deleteButton}
							onClick={() =>
								void del.mutate({
									params: { path: { id: g.id! } },
									headers: { Authorization },
								})
							}
						>
							Delete
						</button>
					</li>
				);
			});

	const renderedGrievances = renderGrievanceItems(
		grievancesQuery.data ?? cachedGrievances
	);

	const { register, handleSubmit, reset } = useForm<NewGrievance>({
		defaultValues: makeDefaultGrievance(),
		resolver: standardSchemaResolver(grievanceSchema),
	});

	return (
		<>
			<form
				className={style.formField}
				onSubmit={backgroundPromise(
					handleSubmit(d => {
						const body: NewGrievance = {
							...d,
							timeZone: clientTimeZone(),
						};
						void create.mutate({
							headers: { Authorization },
							body,
						});
						reset(makeDefaultGrievance());
					})
				)}
			>
				<fieldset>
					<legend>New Grievance</legend>
					<p className={style.formField}>
						<label>
							Name <input {...register('name')} />
						</label>
					</p>
					<p className={style.formField}>
						<label>
							Description{' '}
							<textarea {...register('description')} />
						</label>
					</p>
					<p className={style.formField}>
						<label>
							Priority
							<select
								{...register('priority', {
									valueAsNumber: true,
								})}
							>
								{Array.from(severityMap.entries()).map(
									([level, caption]) => (
										<option key={level} value={level}>
											{caption}
										</option>
									)
								)}
							</select>
						</label>
					</p>
					<input className={style.submitButton} type="submit" />
				</fieldset>
			</form>
			<PendingPip value={Some(grievances)} />
			<ul className={style.grievanceList}>{renderedGrievances}</ul>
		</>
	);
}

export default function GrievancePortal() {
	const [idToken, promptForLogin] = useOIDC();
	const loginReady = option_is_some(promptForLogin);

	const handleLogin = () => {
		if (!loginReady) return;
		const beginLogin = option_unwrap(promptForLogin);
		void beginLogin();
	};

	const loginSection = (
		<div>
			<button
				aria-label="Authenticate with OIDC"
				disabled={!loginReady}
				onClick={handleLogin}
			>
				Login with Google
			</button>
		</div>
	);

	const authenticatedSection = option_and_then(
		idToken,
		Authorization => (
			<>
				<p>You are logged in.</p>
				<GrievanceEditor Authorization={Authorization} />
			</>
		)
	);

	return (
		<div className={style.wrapper}>
			<h1 className={style.header}>💖 Grievance Portal 💖</h1>
			<p className={style.hearts}>we can fix it!</p>
			{option_unwrap_or(authenticatedSection, loginSection)}
		</div>
	);
}
