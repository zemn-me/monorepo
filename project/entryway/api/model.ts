import { initTRPC } from '@trpc/server';
import superjson from 'superjson';
import { z } from 'zod';

import { PrismaClient } from '#root/project/entryway/api/db_client/index.js';

type Ok<T> = { ok: T };
type Error<T> = { error: T };
export type Result<O, E> = Ok<O> | Error<E>;

const db = new PrismaClient();
const t = initTRPC.create({
	transformer: superjson,
});





export const router = t.router({
	createUser: t.procedure
		.input(
			z.object({
			})
		)
		.mutation(({ input }) => db.user.create({ data: input })),
	getCodeEntryUsers: t.procedure.query(() =>
		db.user.findMany({
			where: {
				entryCode: {
					some: {},
				},
			},
		})
	),
	getPhoneEntryUsers: t.procedure.query(() => db.user.findMany(
	entryViaCode: t.procedure
		.input(
			z.object({
				code: z.number(),
			})
		)
		.query(({ input }) =>
			db.$transaction(async () => {
				const entryCode = await db.entryCode.findUnique({
					where: {
						code: input.code,
					},
				});

				if (entryCode == null) return { err: 'not found' };

				await db.codeBasedEntryGrant.create({
					data: {
						entryCodeId: entryCode.id,
						userId: entryCode.userId,
					},
				});

				return { ok: true };
			})
		),
});

export type API = typeof router;
