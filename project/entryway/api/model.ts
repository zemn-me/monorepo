import { z } from 'zod';

export const RoleInput = z.enum(['USER', 'ADMIN']);

export const UserInput = z.object({
	id: z.number().optional(),
	role: RoleInput.optional(),
	email: z.string().email().optional(),
	displayName: z.string().optional(),
	phoneNumber: z.string().optional(),
	entryCode: z.number().optional(),
	authorizesEntryViaPhone: z
		.boolean()
		.optional()
		.describe('Whether the user may authorise an entry via phone.'),
	authorizesEntryViaCode: z
		.boolean()
		.optional()
		.describe(
			'Whether the user may authorize an entry via their personal code.'
		),
});
