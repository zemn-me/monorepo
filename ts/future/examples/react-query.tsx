import { useQuery } from '@tanstack/react-query';
import { future, useQueryFuture } from '#root/ts/future/future.js';

interface Todo {
	id: number;
	title: string;
}

declare function useTheme(): { error: string; todoList: string };

export function TodoList() {
	const theme = useTheme();
	const todos = useQueryFuture(
		useQuery<Todo[], Error>({
			queryKey: ['todos'],
			queryFn: async () => {
				const response = await fetch('/api/todos');
				if (!response.ok) throw new Error('Could not load todos.');
				return response.json() as Promise<Todo[]>;
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
