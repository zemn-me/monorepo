import { initTRPC, TRPCError } from '@trpc/server';
import type { ConnectContactFlowEvent } from 'aws-lambda';
import superjson from 'superjson';

import { Context } from '#root/project/entryway/api/authorization.js';
import { db } from '#root/project/entryway/api/db.js';
import {
	TalkToModelInput,
	UserInput,
} from '#root/project/entryway/api/model.js';
import { JSONObject } from '#root/ts/do-sync';

const t = initTRPC.context<Context>().create({
	transformer: superjson,
});

export interface UserEntryViaCodeInput extends ConnectContactFlowEvent {
	Parameters: {
		pin: number;
	};
}

export interface UserEntryViaCodeResponse extends JSONObject {
	entryGranted: boolean; // yes, really?
}

export const router = t.router({
	talkToModel: t.procedure
		.input(TalkToModelInput)
		.mutation(({ input, ctx }) => {
			const pastConversation =
				id !== undefined
					? db.conversation.findUnique({
							where: {
								id: input.conversationId,
							},
						})
					: undefined;
		}),

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
	/**
	 * Must be called by a service.
	 *
	 * Validates a user entry code.
	 */
	userEntryViaCode: t.procedure
		.input(v => v as UserEntryViaCodeInput)
		.mutation(
			async ({
				input: {
					Parameters: { pin: entryCode },
				},
				ctx,
			}): Promise<UserEntryViaCodeResponse> => {
				if (!ctx.service)
					throw new TRPCError({
						code: 'UNAUTHORIZED',
						message: 'must be service',
					});

				const u = await db.user.findFirst({
					where: { entryCode },
				});

				if (u === null) return { entryGranted: false };

				await db.codeBasedEntryGrant.create({
					data: { entryCode, userId: u.id },
				});

				return { entryGranted: true };
			}
		),
});

export type API = typeof router;
