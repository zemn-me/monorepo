import type { LoaderFunctionArgs } from 'react-router';

export function loader({ request }: LoaderFunctionArgs) {
	return new Response(null, {
		status: 308,
		headers: {
			Location:
				'/experiments/astrological-chart' + new URL(request.url).search,
		},
	});
}
