'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import { z } from 'zod';

import { useDeleteAdminUser, usePostAdminUsers, useGetAdminUsers, usePutAdminUser } from '#root/project/zemn.me/hook/useZemnMeApi.js';
import { useZemnMeAuth } from '#root/project/zemn.me/hook/useZemnMeAuth.js';
import { future_to_option } from '#root/ts/future/option/future_to_option.js';
import {
	is_some as option_is_some,
	unwrap as option_unwrap,
	unwrap_or as option_unwrap_or,
} from '#root/ts/option/types.js';

const addUserSchema = z.object({
	email: z.string().email(),
});

type AddUserForm = z.infer<typeof addUserSchema>;

function UserEditor({ Authorization }: { readonly Authorization: string }) {
	const createUser = usePostAdminUsers(Authorization);
	const usersQuery = useGetAdminUsers(Authorization);
	const updateUser = usePutAdminUser(Authorization);
	const deleteUser = useDeleteAdminUser(Authorization);

	const { register, handleSubmit, reset, formState: { errors } } = useForm<AddUserForm>({
		defaultValues: { email: '' },
		resolver: zodResolver(addUserSchema),
	});

	return (
		<>
			<form
				// eslint-disable-next-line @typescript-eslint/no-misused-promises
				onSubmit={handleSubmit(data => {
					void createUser.mutate({
						headers: { Authorization },
						body: {
							email: data.email,
						},
					});
					reset();
				})}
			>
				<fieldset>
					<legend>Add User</legend>
					<label htmlFor="add-user-email">Email</label>
					<input
						id="add-user-email"
						type="email"
						{...register('email')}
					/>
					{errors.email?.message ? (
						<output htmlFor="add-user-email">{errors.email.message}</output>
					) : null}
					<button type="submit">Add user</button>
				</fieldset>
			</form>
			<section>
				<h2>Users</h2>
				<ul aria-label="Users list">
					{(usersQuery.data ?? []).map(user => (
						<li key={user.id}>
							<code>{user.id}</code>
							{' '}
							{user.email ?? '(no email)'}
							{' '}
							<label>
								Scopes
								<input
									aria-label={`Scopes for ${user.email ?? user.id}`}
									defaultValue={(user.scopes ?? []).join(' ')}
									onBlur={event => {
										const scopes = event.currentTarget.value
											.split(/\s+/)
											.map(s => s.trim())
											.filter(Boolean);
										void updateUser.mutate({
											headers: { Authorization },
											params: { path: { id: user.id } },
											body: {
												scopes,
											},
										});
									}}
								/>
							</label>
							{' '}
							<button
								type="button"
								onClick={() => {
									void deleteUser.mutate({
										headers: { Authorization },
										params: { path: { id: user.id } },
									});
								}}
							>
								Remove
							</button>
						</li>
					))}
				</ul>
			</section>
		</>
	);
}

export default function AdminUsersPageClient() {
	const [fut_idToken, , fut_promptForLogin] = useZemnMeAuth();
	const idToken = future_to_option(fut_idToken);
	const promptForLogin = future_to_option(fut_promptForLogin);
	const loginReady = option_is_some(promptForLogin);

	if (!option_is_some(idToken)) {
		return (
			<button
				aria-label="Authenticate with OIDC"
				disabled={!loginReady}
				onClick={() => {
					if (!loginReady) return;
					void option_unwrap(promptForLogin)();
				}}
			>
				Login with OIDC
			</button>
		);
	}

	return <UserEditor Authorization={option_unwrap_or(idToken, '')} />;
}
