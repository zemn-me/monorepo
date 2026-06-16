'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import { z } from 'zod';

import type { components } from '#root/project/me/zemn/api/api_client.gen.js';
import style from '#root/project/me/zemn/app/admin/users/style.module.css';
import {
	useDeleteAdminUser,
	useGetAdminUsers,
	usePostAdminUsers,
	usePutAdminUser,
} from '#root/project/me/zemn/hook/useZemnMeApi.js';
import { useZemnMeAuth } from '#root/project/me/zemn/hook/useZemnMeAuth.js';

const addUserSchema = z.object({
	email: z.string().email(),
});

type ApiScopes = components['schemas']['OAuthScopes'];

const availableScopes = [
	'admin_uid_read',
	'admin_analytics_read',
	'admin_users_read',
	'admin_users_manage',
	'callbox_settings_read',
	'callbox_settings_write',
	'callbox_key',
	'callbox_key_logs_read',
	'grievance_portal',
	'minecraft',
] as const satisfies readonly (keyof ApiScopes)[];

type AddUserForm = z.infer<typeof addUserSchema>;

function UserEditor({ id_token }: { readonly id_token: string }) {
	const createUser = usePostAdminUsers(id_token);
	const usersQuery = useGetAdminUsers(id_token);
	const updateUser = usePutAdminUser(id_token);
	const deleteUser = useDeleteAdminUser(id_token);

	const {
		register,
		handleSubmit,
		reset,
		formState: { errors },
	} = useForm<AddUserForm>({
		defaultValues: { email: '' },
		resolver: zodResolver(addUserSchema),
	});

	return (
		<>
			<form
				onSubmit={handleSubmit(data => {
					void createUser.mutate({
						headers: { Authorization: id_token },
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
						<output htmlFor="add-user-email">
							{errors.email.message}
						</output>
					) : null}
					<button type="submit">Add user</button>
				</fieldset>
			</form>
			<section
				aria-labelledby="available-scopes-heading"
				className={style.scopeReference}
			>
				<h2 id="available-scopes-heading">Available scopes</h2>
				<p>
					Use these whitespace-separated names in each user&apos;s
					Scopes field.
				</p>
				<ul className={style.scopeList}>
					{availableScopes.map(scope => (
						<li key={scope}>
							<code>{scope}</code>
						</li>
					))}
				</ul>
			</section>
			<section>
				<h2>Users</h2>
				<div
					aria-label="Users list"
					className={style.usersTable}
					role="table"
				>
					<div className={style.headerRow} role="row">
						<div role="columnheader">ID</div>
						<div role="columnheader">Email</div>
						<div role="columnheader">Given Name</div>
						<div role="columnheader">Family Name</div>
						<div role="columnheader">Scopes</div>
						<div role="columnheader">Subject IDs</div>
						<div role="columnheader">Actions</div>
					</div>
					{(usersQuery.data ?? []).map(user => {
						const emails =
							(user.emails ?? []).join(', ') || '(no email)';
						const subjectIds =
							(user.subjectIds ?? []).join(', ') ||
							'(no subjects)';
						const givenName = user.givenName ?? '';
						const familyName = user.familyName ?? '';
						return (
							<div
								className={style.userRow}
								key={user.id}
								role="row"
							>
								<div
									className={style.cell}
									data-label="ID"
									role="cell"
								>
									<code>{user.id}</code>
								</div>
								<div
									className={style.cell}
									data-label="Email"
									role="cell"
								>
									<label className={style.fieldLabel}>
										<span className={style.labelText}>
											Email
										</span>
										<textarea
											aria-label={`Emails for ${user.id}`}
											defaultValue={
												emails === '(no email)'
													? ''
													: emails
											}
											onBlur={event => {
												const nextEmails =
													event.currentTarget.value
														.split(/[,\s]+/)
														.map(s => s.trim())
														.filter(Boolean);
												void updateUser.mutate({
													headers: {
														Authorization: id_token,
													},
													body: {
														id: user.id,
														emails: nextEmails,
													},
												});
											}}
											rows={2}
											className={style.textArea}
										/>
									</label>
								</div>
								<div
									className={style.cell}
									data-label="Given Name"
									role="cell"
								>
									<label className={style.fieldLabel}>
										<span className={style.labelText}>
											Given Name
										</span>
										<input
											aria-label={`Given name for ${user.id}`}
											defaultValue={givenName}
											onBlur={event => {
												void updateUser.mutate({
													headers: {
														Authorization: id_token,
													},
													body: {
														id: user.id,
														givenName:
															event.currentTarget.value.trim(),
													},
												});
											}}
											className={style.textInput}
										/>
									</label>
								</div>
								<div
									className={style.cell}
									data-label="Family Name"
									role="cell"
								>
									<label className={style.fieldLabel}>
										<span className={style.labelText}>
											Family Name
										</span>
										<input
											aria-label={`Family name for ${user.id}`}
											defaultValue={familyName}
											onBlur={event => {
												void updateUser.mutate({
													headers: {
														Authorization: id_token,
													},
													body: {
														id: user.id,
														familyName:
															event.currentTarget.value.trim(),
													},
												});
											}}
											className={style.textInput}
										/>
									</label>
								</div>
								<div
									className={style.cell}
									data-label="Scopes"
									role="cell"
								>
									<label className={style.fieldLabel}>
										<span className={style.labelText}>
											Scopes
										</span>
										<textarea
											aria-label={`Scopes for ${emails}`}
											defaultValue={(
												user.scopes ?? []
											).join(' ')}
											onBlur={event => {
												const scopes =
													event.currentTarget.value
														.split(/\s+/)
														.map(s => s.trim())
														.filter(Boolean);
												void updateUser.mutate({
													headers: {
														Authorization: id_token,
													},
													body: {
														id: user.id,
														scopes,
													},
												});
											}}
											rows={2}
											className={style.textArea}
										/>
									</label>
								</div>
								<div
									className={style.cell}
									data-label="Subject IDs"
									role="cell"
								>
									<label className={style.fieldLabel}>
										<span className={style.labelText}>
											Subject IDs
										</span>
										<textarea
											aria-label={`Subject IDs for ${user.id}`}
											defaultValue={
												subjectIds === '(no subjects)'
													? ''
													: subjectIds
											}
											onBlur={event => {
												const nextSubjectIds =
													event.currentTarget.value
														.split(/[,\s]+/)
														.map(s => s.trim())
														.filter(Boolean);
												void updateUser.mutate({
													headers: {
														Authorization: id_token,
													},
													body: {
														id: user.id,
														subjectIds:
															nextSubjectIds,
													},
												});
											}}
											rows={2}
											className={style.textArea}
										/>
									</label>
								</div>
								<div
									className={style.cell}
									data-label="Actions"
									role="cell"
								>
									<button
										disabled={!user.deletable}
										onClick={() => {
											void deleteUser.mutate({
												headers: {
													Authorization: id_token,
												},
												body: { id: user.id },
											});
										}}
										type="button"
									>
										Remove
									</button>
								</div>
							</div>
						);
					})}
				</div>
			</section>
		</>
	);
}

export default function AdminUsersPageClient() {
	const [fut_idToken, , fut_promptForLogin] = useZemnMeAuth();
	const loginPanel = fut_promptForLogin(
		promptForLogin => (
			<button
				aria-label="Authenticate with OIDC"
				onClick={() => {
					void promptForLogin();
				}}
				type="button"
			>
				Login with OIDC
			</button>
		),
		() => (
			<button aria-label="Authenticate with OIDC" disabled type="button">
				Login with OIDC
			</button>
		),
		() => (
			<button aria-label="Authenticate with OIDC" disabled type="button">
				Login with OIDC
			</button>
		)
	);

	return fut_idToken(
		idToken => <UserEditor id_token={idToken} />,
		() => loginPanel,
		() => loginPanel
	);
}
