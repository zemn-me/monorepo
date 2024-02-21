import { z } from 'zod';

import { PrismaClient } from '#root/project/entryway/api/db/index.js';

type Ok<T> = { ok: T };
type Error<T> = { error: T };
export type Result<O, E> = Ok<O> | Error<E>;

export const db = new PrismaClient();

export const RoleInput = z.enum(['USER', 'ADMIN']);

export const UserInput = z.object({
	id: z.number().optional(),
	role: RoleInput,
	email: z.string().email().optional(),
	displayName: z.string().optional(),
	phoneNumber: z.string().optional(),
	entryCode: z.number().optional(),
	authorizesEntryViaPhone: z.boolean().optional(),
	entryCodeId: z.number().optional(),
});
