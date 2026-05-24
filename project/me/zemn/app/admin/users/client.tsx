'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import { z } from 'zod';

import style from '#root/project/me/zemn/app/admin/users/style.module.css';
import {
	useDeleteAdminUser,
	useGetAdminUsers,
	usePostAdminUsers,
	usePutAdminUser,
} from '#root/project/me/zemn/hook/useZemnMeApi.js';
import { useZemnMeAuth } from '#root/project/me/zemn/hook/useZemnMeAuth.js';
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

	return <UserEditor id_token={option_unwrap_or(idToken, '')} />;
}
