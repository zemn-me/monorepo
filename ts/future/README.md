# `@zemnmez/future`

`@zemnmez/future` is a tiny TypeScript type for a value that may be loading,
resolved, or errored. A `Future<Then, Loading, Error>` represents all three
states exactly and requires each state to be handled before its resolved value
can be used.

Like [`@zemnmez/result`][result], `Future` is implemented purely functionally.
Advanced JavaScript and TypeScript compilers can inline its implementation, so
no class names, property names, discriminants, or symbols identifying a Future
need to remain in a minified bundle.

## React Query

`useQueryFuture` converts a React Query result into a `Future`. This is useful
when a component should call all of its hooks unconditionally and select its
loading, error, or resolved UI only after those hooks have run:

```tsx
import { useQuery } from '@tanstack/react-query';
import { future, useQueryFuture } from '@zemnmez/future';

interface Todo {
	id: number;
	title: string;
}

function TodoList() {
	const theme = useTheme();
	const todos = useQueryFuture(
		useQuery<Todo[], Error>({
			queryKey: ['todos'],
			queryFn: async () => {
				const response = await fetch('/api/todos');
				if (!response.ok) throw new Error('Could not load todos.');
				return response.json();
			},
		})
	);

	return future(
		todos,
		todos => (
			<ul className={theme.todoList}>
				{todos.map(todo => (
					<li key={todo.id}>{todo.title}</li>
				))}
			</ul>
		),
		() => <p>Loading todos…</p>,
		error => <p className={theme.error}>{error.message}</p>
	);
}
```

## Usage

Construct a Future with `resolve`, `loading`, or `error`, then handle its three
possible states with `future`:

```typescript
import { Future, future, resolve } from '@zemnmez/future';

const answer: Future<number, number, Error> = resolve(42);
const message = future(
	answer,
	value => `The answer is ${value}.`,
	progress => `Loading: ${progress}%`,
	error => `Failed: ${error.message}`
);
```

`future_and_then` maps a resolved value while preserving the loading and error
types. `future_flatten_then` flattens nested Futures, and `future_collect`
combines several Futures into one.

## Pipelines

`future_and_then` and `future_flatten_then` compose Future-returning operations
into a pipeline. Each operation receives the preceding resolved value, while a
loading or error state stops the pipeline:

```typescript
import {
	error,
	Future,
	future_and_then,
	future_flatten_then,
	resolve,
} from '@zemnmez/future';

interface User {
	id: number;
	name: string;
}

const findUser = (
	id: number
): Future<User, 'fetching user', 'user not found'> =>
	id === 42
		? resolve({ id, name: 'Deep Thought' })
		: error('user not found');

const displayName = (
	user: User
): Future<string, 'formatting name', 'missing name'> =>
	user.name ? resolve(user.name) : error('missing name');

const user = future_flatten_then(
	future_and_then(resolve(42), findUser)
);
const name = future_flatten_then(
	future_and_then(user, displayName)
);
// Future<
//   string,
//   'fetching user' | 'formatting name',
//   'user not found' | 'missing name'
// >
```

[result]: https://www.npmjs.com/package/@zemnmez/result
