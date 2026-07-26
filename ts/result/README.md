# `@zemnmez/result`

`@zemnmez/result` is a TypeScript implementation of Rust's
[`Result<T, E>`][rust-result] type. A `Result` represents, exactly and in a
type-safe manner, the result of a sequence of any number of operations that
may potentially fail.

The benefit is that every possible failure remains explicit in the return
type, even across long chains of operations. The tradeoff is that a `Result`
must be handled explicitly before its successful value can be used.

In React, this can effectively eliminate early returns from components that
would otherwise violate the [Rules of Hooks][rules-of-hooks]. A function that
may fail can return a `Result`, while the component calls every hook
unconditionally and uses `unwrap_or_else` to select its success or failure UI:

```typescript
import {
	and_then,
	Err,
	Ok,
	Result,
	unwrap_or_else,
} from '@zemnmez/result';

interface Todo {
	id: number;
	title: string;
}

async function fetchTodos(): Promise<Result<Todo[], Error>> {
	try {
		const response = await fetch('/api/todos');
		if (!response.ok) {
			return Err(new Error('The server could not load your todos.'));
		}

		return Ok((await response.json()) as Todo[]);
	} catch (cause) {
		return Err(
			cause instanceof Error
				? cause
				: new Error('Could not connect to the server.', {
						cause,
					})
		);
	}
}

function TodoList({
	todos,
}: {
	todos: Result<Todo[], Error>;
}) {
	const theme = useTheme();

	return unwrap_or_else(
		and_then(todos, todos => (
			<ul className={theme.todoList}>
				{todos.map(todo => (
					<li key={todo.id}>{todo.title}</li>
				))}
			</ul>
		)),
		error => (
			<p className={theme.error}>{error.message}</p>
		)
	);
}
```

## Implementation

`Result` is implemented purely functionally. Advanced JavaScript and
TypeScript compilers can therefore erase or inline its inner functionality.
With a minifier, no class names, constructor names, property names,
discriminant strings, or symbols identifying `Ok` or `Err` need to occupy
space in the resulting bundle.

The representation is intentionally opaque. Inspect a result with `is_ok`,
`is_err`, `unwrap`, `unwrap_err`, or the provided combinators rather than
runtime properties.

## Usage

`and_then` maps the successful value. `and_then_flatten` chains an operation
that can itself fail. Curried `map_result` and `bind_result` work well in
pipelines:

```typescript
import { bind_result, Err, Ok, unwrap } from '@zemnmez/result';

const doubled = bind_result((value: number) =>
	value >= 0 ? Ok(value * 2) : Err('negative')
);

const result = doubled(Ok(21));
unwrap(result); // 42
```

`pipe_result` chains several Result-returning functions from left to right and
stops at the first `Err`.

[rules-of-hooks]: https://react.dev/reference/rules/rules-of-hooks
[rust-result]: https://doc.rust-lang.org/std/result/enum.Result.html
