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

function UserEditor({ id_token }: { readonly id_token: string }) {
	const createUser = usePostAdminUsers(id_token);
	const usersQuery = useGetAdminUsers(id_token);
	const updateUser = usePutAdminUser(id_token);
	const deleteUser = useDeleteAdminUser(id_token);
	const gridStyle = {
		display: 'grid',
		gridTemplateColumns: 'minmax(10rem, 1fr) minmax(14rem, 1fr) minmax(12rem, 1fr) minmax(12rem, 1fr) minmax(18rem, 2fr) minmax(16rem, 1fr) auto',
		gap: '0.5rem 1rem',
		alignItems: 'center',
	} as const;
	const gridRowStyle = {
		display: 'contents',
	} as const;
	const scopesLabelStyle = {
		display: 'grid',
		gap: '0.25rem',
	} as const;
	const scopesInputStyle = {
		width: '100%',
		minWidth: 0,
		resize: 'vertical',
		whiteSpace: 'pre-wrap',
		overflowWrap: 'anywhere',
	} as const;
	const subjectIdsStyle = {
		display: 'block',
		whiteSpace: 'pre-wrap',
		overflowWrap: 'anywhere',
		wordBreak: 'break-word',
	} as const;
	const textInputStyle = {
		width: '100%',
		minWidth: 0,
	} as const;

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
						<output htmlFor="add-user-email">{errors.email.message}</output>
					) : null}
					<button type="submit">Add user</button>
				</fieldset>
			</form>
			<section>
				<h2>Users</h2>
				<div aria-label="Users list" role="table" style={gridStyle}>
					<div role="row" style={{ ...gridRowStyle, fontWeight: 600 }}>
						<div role="columnheader">ID</div>
						<div role="columnheader">Email</div>
						<div role="columnheader">Given Name</div>
						<div role="columnheader">Family Name</div>
						<div role="columnheader">Scopes</div>
						<div role="columnheader">Subject IDs</div>
						<div role="columnheader">Actions</div>
					</div>
					{(usersQuery.data ?? []).map(user => {
						const emails = (user.emails ?? []).join(', ') || '(no email)';
						const subjectIds = (user.subjectIds ?? []).join(', ') || '(no subjects)';
						const givenName = user.givenName ?? '';
						const familyName = user.familyName ?? '';
						return (
						<div key={user.id} role="row" style={gridRowStyle}>
							<div role="cell"><code>{user.id}</code></div>
							<div role="cell">
								<label style={scopesLabelStyle}>
									<span>Email</span>
									<textarea
										aria-label={`Emails for ${user.id}`}
										defaultValue={emails === '(no email)' ? '' : emails}
										rows={2}
										style={scopesInputStyle}
										onBlur={event => {
											const nextEmails = event.currentTarget.value
												.split(/[,\s]+/)
												.map(s => s.trim())
												.filter(Boolean);
											void updateUser.mutate({
												headers: { Authorization: id_token },
												body: {
													id: user.id,
													emails: nextEmails,
												},
											});
										}}
									/>
								</label>
							</div>
							<div role="cell">
								<label style={scopesLabelStyle}>
									<span>Given Name</span>
									<input
										aria-label={`Given name for ${user.id}`}
										defaultValue={givenName}
										style={textInputStyle}
										onBlur={event => {
											void updateUser.mutate({
												headers: { Authorization: id_token },
												body: {
													id: user.id,
													givenName: event.currentTarget.value.trim(),
												},
											});
										}}
									/>
								</label>
							</div>
							<div role="cell">
								<label style={scopesLabelStyle}>
									<span>Family Name</span>
									<input
										aria-label={`Family name for ${user.id}`}
										defaultValue={familyName}
										style={textInputStyle}
										onBlur={event => {
											void updateUser.mutate({
												headers: { Authorization: id_token },
												body: {
													id: user.id,
													familyName: event.currentTarget.value.trim(),
												},
											});
										}}
									/>
								</label>
							</div>
							<div role="cell">
								<label style={scopesLabelStyle}>
									<span>Scopes</span>
									<textarea
										aria-label={`Scopes for ${emails}`}
										defaultValue={(user.scopes ?? []).join(' ')}
										rows={2}
										style={scopesInputStyle}
										onBlur={event => {
											const scopes = event.currentTarget.value
												.split(/\s+/)
												.map(s => s.trim())
												.filter(Boolean);
											void updateUser.mutate({
												headers: { Authorization: id_token },
												body: {
													id: user.id,
													scopes,
												},
											});
										}}
									/>
								</label>
							</div>
							<div role="cell">
								<label style={scopesLabelStyle}>
									<span>Subject IDs</span>
									<textarea
										aria-label={`Subject IDs for ${user.id}`}
										defaultValue={subjectIds === '(no subjects)' ? '' : subjectIds}
										rows={2}
										style={{ ...scopesInputStyle, ...subjectIdsStyle }}
										onBlur={event => {
											const nextSubjectIds = event.currentTarget.value
												.split(/[,\s]+/)
												.map(s => s.trim())
												.filter(Boolean);
											void updateUser.mutate({
												headers: { Authorization: id_token },
												body: {
													id: user.id,
													subjectIds: nextSubjectIds,
												},
											});
										}}
									/>
								</label>
							</div>
							<div role="cell">
								<button
									type="button"
									disabled={!user.deletable}
									onClick={() => {
										void deleteUser.mutate({
											headers: { Authorization: id_token },
											body: { id: user.id },
										});
									}}
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
