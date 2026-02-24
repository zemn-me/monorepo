'use client';
import { standardSchemaResolver } from '@hookform/resolvers/standard-schema';
import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { Temporal } from 'temporal-polyfill';
import { z } from 'zod';

import type { components } from '#root/project/zemn.me/api/api_client.gen';
import style from '#root/project/zemn.me/app/grievanceportal/style.module.css';
import { useGetExactContactByEmail } from '#root/project/zemn.me/hook/useGetExactContactByEmail.js';
import {
	useGetGrievances,
	usePostGrievances,
} from '#root/project/zemn.me/hook/useZemnMeApi.js';
import { useZemnMeAuth } from '#root/project/zemn.me/hook/useZemnMeAuth.js';
import { future_and_then, future_or_else } from '#root/ts/future/future.js';
import { useQueryFuture } from '#root/ts/future/react-query/useQuery.js';
import { displayPersonName } from '#root/ts/google/people/display.js';
import { isDefined } from '#root/ts/guard.js';
import { None, option_and_then_flatten, option_from_maybe_undefined, option_unwrap_or } from '#root/ts/option/types.js';
import { PrettyDateTime } from '#root/ts/react/lang/date.js';

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

function GrievanceAuthorLabel(props: {
	readonly name?: string | null;
	readonly poster?: Grievance['poster'] | null;
}) {
	const contact = useGetExactContactByEmail(
		option_from_maybe_undefined(props.poster?.email_address),
		new Set([
			"names",
			"nicknames",
		])
	);

	if (props.name !== undefined && props.name !== null) {
		return <>{props.name}</>;
	}

	const posterNameArray = [
		props.poster?.given_name,
		props.poster?.family_name,
	].filter(isDefined);

	const posterName = posterNameArray.length > 0 ? posterNameArray.join(" ") : undefined;

	const contactName = option_unwrap_or(
		contact(
			() => None,
			person => option_and_then_flatten(
				person,
				person => displayPersonName(person)
			)
		),
		undefined,
	);

	const fallback = contactName
		?? posterName
		?? props.poster?.email_address
		?? props.poster?.sub;

	return fallback ? <>{fallback}</> : null;
}

function GrievanceEditor({ Authorization }: GrievanceEditorProps) {
	const create = usePostGrievances(Authorization);
	const grievancesQuery = useGetGrievances(Authorization);
	const grievances_a = future_or_else(useQueryFuture(grievancesQuery), e =>
			(e as object) instanceof Error
				? (e as Error)
				: new Error(String(e))
	);

	const grievances = future_and_then(grievances_a,
		g => g === undefined? [] : g
	)


	const [cachedGrievances, setCachedGrievances] = useState<Grievance[]>([]);

	useEffect(() => {
		future_and_then(
			grievances, g => setCachedGrievances(g)
		)
	}, [grievances]);

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
						<strong>
							<GrievanceAuthorLabel
								name={g.name}
								poster={g.poster}
							/>
						</strong>
						{' ('}
						{severityMap.get(g.priority) ?? `level ${g.priority}`}
						{')'}
						<p>
							<PrettyDateTime date={createdAt} />
						</p>
						<pre>{g.description}</pre>
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
			{
				grievances(
					() => null,
					() => <span>⌛</span>,
					err => <span>Error: {err.message}</span>
				)
			}
			<ul className={style.grievanceList}>{renderedGrievances}</ul>
		</>
	);
}

export default function GrievancePortal() {
	const [fut_idToken, , fut_promptForLogin] = useZemnMeAuth();

	const handleLogin = () => {
		void fut_promptForLogin(
			prompt => prompt(),
			() => { },
			() => { },
		)
	};

	const loginSection = (
		<div>
			<button
				aria-label="Authenticate with OIDC"
				disabled={!fut_promptForLogin(
					() => true,
					() => false,
					() => false,
				)}
				onClick={handleLogin}
			>
				Login with Google
			</button>
		</div>
	);


	return (
		<div className={style.wrapper}>
			<h1 className={style.header}>💖 Grievance Portal 💖</h1>
			<p className={style.hearts}>we can fix it!</p>
			{
				fut_idToken(
					Authorization => (
						<>
							<p>You are logged in.</p>
							<GrievanceEditor Authorization={Authorization} />
						</>
					),
					() => loginSection,
					err => <>{loginSection} Error loading id_token: {err.message}</>,
				)
			}
		</div>
	);
}
