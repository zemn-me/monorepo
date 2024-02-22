import { initTRPC, TRPCError } from '@trpc/server';
import superjson from 'superjson';

import { Context } from '#root/project/entryway/api/authorization.js';
import { db } from '#root/project/entryway/api/db.js';
import { UserInput } from '#root/project/entryway/api/model.js';

const t = initTRPC.context<Context>().create({
	transformer: superjson,
});

export const router = t.router({
	upsertUser: t.procedure.input(UserInput).mutation(({ input, ctx }) => {
		if (!ctx.user || ctx.user.role == 'ADMIN' || ctx.user.id === input.id)
			throw new TRPCError({ code: 'UNAUTHORIZED' });

		const { id: uid, ...inputWithoutId } = input;

		return db.user.upsert({
			where: { id: uid },
			update: inputWithoutId,
			create: inputWithoutId,
		});
	}),
});

export type API = typeof router;
