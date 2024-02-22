/* eslint-disable react/no-children-prop */
'use client';

import { useForm } from '@tanstack/react-form';
import { z } from 'zod';

import { api } from '#root/project/entryway/api/client/client.js';
import { RoleInput, UserInput } from '#root/project/entryway/api/model.js';

interface UserCardetteProps {
	readonly user: z.TypeOf<typeof UserInput>;
}

/**
 * Allow editing and display of a user, or a partial
 * of a user for creation.
 */
export function UserView({ user }: UserCardetteProps) {
	const upsertUser = api.upsertUser.useMutation();
	const form = useForm({
		defaultValues: user,
		onSubmit: async ({ value }) => upsertUser.mutate(value),
	});

	return (
		<form.Provider>
			<form
				onSubmit={e => {
					e.preventDefault();
					e.stopPropagation();
					void form.handleSubmit();
				}}
			>
				<form.Field
					children={field => (
						<>
							<label htmlFor={field.name}>Role</label>
							<select
								id={field.name}
								name={field.name}
								onBlur={field.handleBlur}
								onChange={e =>
									field.handleChange(() =>
										RoleInput.parse(e.target.value)
									)
								}
								value={field.state.value ?? ''}
							>
								{Array.from(
									Object.entries(RoleInput.Values)
								).map(([k, v]) => (
									<option key={k} value={v}>
										{v}
									</option>
								))}
							</select>
							{field.state.meta.errors.length ? (
								<em role="alert">
									†{field.state.meta.errors.join(',')}
								</em>
							) : null}
						</>
					)}
					name="role"
					validators={{
						onChangeAsync: async ({
							value,
							fieldApi: { name },
						}) => {
							const parsed =
								await UserInput.shape[name].safeParseAsync(
									value
								);
							if (parsed.success) return false;
							return parsed.error.toString();
						},
					}}
				/>

				<form.Field
					children={field => (
						<label htmlFor={field.name}>
							Email
							<input
								id={field.name}
								name={field.name}
								onBlur={field.handleBlur}
								onChange={e =>
									field.handleChange(e.target.value)
								}
								type="text"
								value={field.state.value ?? ''}
							/>
							{field.state.meta.errors.length ? (
								<em role="alert">
									†{field.state.meta.errors.join(',')}
								</em>
							) : null}
						</label>
					)}
					name="email"
					validators={{
						onChangeAsync: async ({
							value,
							fieldApi: { name },
						}) => {
							const parsed =
								await UserInput.shape[name].safeParseAsync(
									value
								);
							if (parsed.success) return false;
							return parsed.error.toString();
						},
					}}
				/>
				<form.Field
					children={field => (
						<>
							<label htmlFor={field.name}>Display Name</label>
							<input
								id={field.name}
								name={field.name}
								onBlur={field.handleBlur}
								onChange={e =>
									field.handleChange(e.target.value)
								}
								type="text"
								value={field.state.value ?? ''}
							/>
							{field.state.meta.errors.length ? (
								<em role="alert">
									†{field.state.meta.errors.join(',')}
								</em>
							) : null}
						</>
					)}
					name="displayName"
					validators={{
						onChangeAsync: async ({
							value,
							fieldApi: { name },
						}) => {
							const parsed =
								await UserInput.shape[name].safeParseAsync(
									value
								);
							if (parsed.success) return false;
							return parsed.error.toString();
						},
					}}
				/>
				<fieldset>
					<legend>Phone-based entry</legend>
					<p>
						The user may be called when someone tries to enter –
						they may then choose to let the entrant in.
					</p>
					<form.Field
						children={field => (
							<>
								<label htmlFor={field.name}>Phone Number</label>
								<input
									id={field.name}
									name={field.name}
									onBlur={field.handleBlur}
									onChange={e =>
										field.handleChange(e.target.value)
									}
									type="text"
									value={field.state.value ?? ''}
								/>
								{field.state.meta.errors.length ? (
									<em role="alert">
										†{field.state.meta.errors.join(',')}
									</em>
								) : null}
							</>
						)}
						name="phoneNumber"
						validators={{
							onChangeAsync: async ({
								value,
								fieldApi: { name },
							}) => {
								const parsed =
									await UserInput.shape[name].safeParseAsync(
										value
									);
								if (parsed.success) return false;
								return parsed.error.toString();
							},
						}}
					/>
					<form.Field
						children={field => (
							<>
								<label htmlFor={field.name}>
									This user may authorize entry by phone
								</label>
								<input
									id={field.name}
									name={field.name}
									onBlur={field.handleBlur}
									onChange={e => e.target.checked}
									type="checkbox"
									value={field.name}
								/>
								{field.state.meta.errors.length ? (
									<em role="alert">
										†{field.state.meta.errors.join(',')}
									</em>
								) : null}
							</>
						)}
						name="authorizesEntryViaPhone"
						validators={{
							onChangeAsync: async ({
								value,
								fieldApi: { name },
							}) => {
								const parsed =
									await UserInput.shape[name].safeParseAsync(
										value
									);
								if (parsed.success) return false;
								return parsed.error.toString();
							},
						}}
					/>
				</fieldset>
				<fieldset>
					<legend>Code-based Entry</legend>
					<p>
						{form.getFieldValue('displayName') ?? 'The user'} may
						authorize their own entry with a personal code.
					</p>
					<form.Field
						children={field => (
							<>
								<label htmlFor={field.name}>Entry Code</label>
								<input
									id={field.name}
									name={field.name}
									onBlur={field.handleBlur}
									onChange={e =>
										field.handleChange(() =>
											UserInput.shape.entryCode.parse(
												e.target.value
											)
										)
									}
									type="text"
									value={field.state.value ?? ''}
								/>
								{field.state.meta.errors.length ? (
									<em role="alert">
										†{field.state.meta.errors.join(',')}
									</em>
								) : null}
							</>
						)}
						name="entryCode"
						validators={{
							onChangeAsync: async ({
								value,
								fieldApi: { name },
							}) => {
								const parsed =
									await UserInput.shape[name].safeParseAsync(
										value
									);
								if (parsed.success) return false;
								return parsed.error.toString();
							},
						}}
					/>
					<form.Field
						children={field => (
							<>
								<label htmlFor={field.name}>
									The user may authorize entry by code
								</label>
								<input
									checked={field.state.value}
									id={field.name}
									name={field.name}
									onBlur={field.handleBlur}
									onChange={e =>
										field.handleChange(e.target.checked)
									}
									type="checkbox"
									value={field.name}
								/>
								{field.state.meta.errors.length ? (
									<em role="alert">
										†{field.state.meta.errors.join(',')}
									</em>
								) : null}
							</>
						)}
						name="authorizesEntryViaCode"
						validators={{
							onChangeAsync: async ({
								value,
								fieldApi: { name },
							}) => {
								const parsed =
									await UserInput.shape[name].safeParseAsync(
										value
									);
								if (parsed.success) return false;
								return parsed.error.toString();
							},
						}}
					/>
				</fieldset>
			</form>
		</form.Provider>
	);
}
