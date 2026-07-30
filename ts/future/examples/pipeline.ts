import {
	error,
	type Future,
	future_and_then,
	future_flatten_then,
	resolve,
} from '#root/ts/future/future.js';

interface User {
	id: number;
	name: string;
}

export const findUser = (
	id: number
): Future<User, 'fetching user', 'user not found'> =>
	id === 42
		? resolve({ id, name: 'Deep Thought' })
		: error('user not found');

export const displayName = (
	user: User
): Future<string, 'formatting name', 'missing name'> =>
	user.name ? resolve(user.name) : error('missing name');

const user = future_flatten_then(future_and_then(resolve(42), findUser));
export const name = future_flatten_then(future_and_then(user, displayName));
