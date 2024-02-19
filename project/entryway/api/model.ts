import { APIGatewayProxyEventV2, APIGatewayProxyResultV2 } from 'aws-lambda';

import { PrismaClient } from '#root/project/entryway/api/db_client/index.js';
import { Err, Ok, Result } from '#root/ts/result.js';

const db = new PrismaClient();

export class NotFound extends Error {
	constructor(what: string) {
		super(`${what} not found`);
	}
}

export class EntryCodeNotFound extends NotFound {
	constructor() {
		super('entryCode');
	}
}

type Handler = (
	event: APIGatewayProxyEventV2
) => Promise<APIGatewayProxyResultV2>;

function rest(path: string, verb: string) {
	return function (f: Handler): Handler {
		return function (event: APIGatewayProxyEventV2) {
			throw new Error('unimplemented');
			return f(event);
	};
}

export const authenticateViaCode = rest('/authenticatevia/code', 'POST')( function authenticateViaCode(

): Promise<Result<void, Error>> {
	return db.$transaction(async function transact() {
		const entryCode = await db.entryCode.findUnique({
			where: {
				code: code,
			},
		});

		if (entryCode == null) return { [Err]: new NotFound('entryCode') };

		await db.codeBasedEntryGrant.create({
			data: {
				entryCodeId: entryCode.id,
				userId: entryCode.userId,
			},
		});

		return { [Ok]: undefined };
	});
})
