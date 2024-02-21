'use client';

import { useId } from 'react';

import type { User } from '#root/dist/bin/project/entryway/api/db/index.js';
import { api } from '#root/project/entryway/api/client/client.js';
import { useForm } from '@tanstack/react-form';

interface UserCardetteProps {
	readonly user: Partial<User>;
}

/**
 * Allow editing and display of a user, or a partial
 * of a user for creation.
 */
export function UserView({ user }: UserCardetteProps) {
	const form = useForm({
		defaultValues: user,
	onSubmit: async ({ value }) => api.upsertUser(value)
	});

	return (
		<form>
			<label htmlFor={roleId}>
				Role{' '}
				<select id={roleId} value={user.role}>
					<option value="ADMIN">Administrator</option>
					<option value="USER">Regular User</option>
				</select>
			</label>
			<label htmlFor={emailId}>
				Email
				<input id={emailId} value={user.email ?? undefined} />
			</label>
			<label htmlFor={displayNameId}>
				<input
					id={displayNameId}
					value={user.displayName ?? undefined}
				/>
			</label>
			<label htmlFor={phoneNumberId}>
				Phone number
				<input
			</label>
			{/* entry codes editor goes here... */}
			<label htmlFor={phoneAuthorizerId}>
				May authorize entry by phone
				<input
					checked={user.authorizesEntryViaPhone ?? false}
					id={phoneAuthorizerId}
					type="checkbox"
					value="true"
				/>
			</label>
		</form>
	);
}

function UserCardette({ user }: UserCardetteProps) {
	return <>{user.displayName ? user.displayName : user.email}</>;
}

export function Page() {
	const codeEntryUsers = api.getCodeEntryUsers.useQuery();
	return (
		<article>
			{codeEntryUsers.error ? (
				<>Failed. Sorry :(</>
			) : (
				<ul>
					{codeEntryUsers.data?.map(user => (
						<li key={user.id}>
							<UserCardette user={user} />
						</li>
					))}
				</ul>
			)}
		</article>
	);
}
