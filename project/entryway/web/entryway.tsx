'use client';

import type { User } from '#root/dist/bin/project/entryway/api/db_client/index.js';
import { api } from '#root/project/entryway/api/client/client.js';

interface UserCardetteProps {
	readonly user: User;
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
