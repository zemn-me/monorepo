import { randomUUID } from 'node:crypto';
import {
	type ActionFunctionArgs,
	data,
	Form,
	type HeadersFunction,
	type LoaderFunctionArgs,
	redirect,
	useLoaderData,
} from 'react-router';

export function loader({ request }: LoaderFunctionArgs) {
	return data(
		{
			name: new URL(request.url).searchParams.get('name'),
			revision: randomUUID(),
		},
		{
			headers: { 'cache-control': 'public, max-age=0, s-maxage=60' },
		}
	);
}
export const headers: HeadersFunction = ({ loaderHeaders }) => loaderHeaders;
export async function action({ request }: ActionFunctionArgs) {
	const form = await request.formData();
	return redirect(
		`/live?name=${encodeURIComponent(String(form.get('name')))}`,
		303
	);
}
export default function Live() {
	const value = useLoaderData<typeof loader>();
	return (
		<>
			<h1>Hello {value.name}</h1>
			<p>{value.revision}</p>
			<Form method="post">
				<input name="name" />
				<button type="submit">Save</button>
			</Form>
		</>
	);
}
