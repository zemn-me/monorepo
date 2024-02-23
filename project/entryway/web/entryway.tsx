/* eslint-disable react/no-children-prop */
'use client';

import { z } from 'zod';

import { api } from '#root/project/entryway/api/client/client.js';
import { UserInput } from '#root/project/entryway/api/model.js';

interface UserCardetteProps {
	readonly user: z.TypeOf<typeof UserInput>;
}

// super uggo. i think i will rewrite without tanstack form

/**
 * Allow editing and display of a user, or a partial
 * of a user for creation.
 */
export function UserView({ user }: UserCardetteProps) {
	const upsertUser = api.upsertUser.useMutation();
	for (const [fieldName, field] of Object.entries(UserInput.shape)) {
		field;
	}
}
