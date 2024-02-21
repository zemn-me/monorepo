import { initTRPC } from '@trpc/server';
import superjson from 'superjson';
import { z } from 'zod';

import { PrismaClient } from '#root/project/entryway/api/db/index.js';

type Ok<T> = { ok: T };
type Error<T> = { error: T };
export type Result<O, E> = Ok<O> | Error<E>;

const db = new PrismaClient();
const t = initTRPC.create({
	transformer: superjson,
});


export const RoleInput = z.enum(["USER", "ADMIN"]);

export const UserInput = z.object({
	role: RoleInput,
	email: z.string().email().optional(),
	displayName: z.string().optional(),
	phoneNumber: z.string().optional(),
	entryCode: z.number().optional(),
	authorizesEntryViaPhone: z.boolean().optional(),
});


export const router = t.router({
	upsertUser: t.procedure
		.input(UserInput)
		.mutation(({ input }) => db.user.upsert({ data: user }),


});

export type API = typeof router;
