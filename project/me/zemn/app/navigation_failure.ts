import { useEffect, useRef, useState } from 'react';
import {
	createPath,
	type DataStrategyResult,
	type MiddlewareFunction,
	useLocation,
	useNavigate,
	useNavigation,
} from 'react-router';

// Registered only by the mounted browser layout; SSR never retains a visitor.
let recover: ((request: Request) => void) | undefined;

function isTransportError(error: unknown): boolean {
	if (!(error instanceof Error)) return false;
	if (error.message === 'Unable to decode turbo-stream response')
		return isTransportError(error.cause);
	return (
		error instanceof TypeError &&
		/^(Failed to fetch|Load failed|network error|NetworkError when attempting to fetch resource\.?)$/i.test(
			error.message
		)
	);
}

export const recoverFailedNavigation: MiddlewareFunction = async (
	{ request },
	next
) => {
	const results = await next();
	if (
		request.method === 'GET' &&
		!request.signal.aborted &&
		Object.values(results as Record<string, DataStrategyResult>).some(
			result => result.type === 'error' && isTransportError(result.result)
		)
	) {
		// Starting a navigation to the committed location aborts this failed
		// transition before the router installs its error boundary.
		recover?.(request);
	}
	return results;
};

export function useNavigationFailure() {
	const location = useLocation();
	const navigation = useNavigation();
	const navigate = useNavigate();
	const current = useRef({ location, navigation });
	current.current = { location, navigation };
	const [failed, setFailed] = useState(false);

	useEffect(() => {
		const handler = (request: Request) => {
			const { location: committed, navigation: pending } =
				current.current;
			if (pending.state !== 'loading' || pending.formMethod) return;
			const destination = new URL(request.url);
			if (
				pending.location.pathname !== destination.pathname ||
				pending.location.search !== destination.search
			)
				return;
			setFailed(true);
			void navigate(createPath(committed), {
				replace: true,
				state: committed.state,
				preventScrollReset: true,
				defaultShouldRevalidate: false,
			});
		};
		recover = handler;
		return () => {
			if (recover === handler) recover = undefined;
		};
	}, [navigate]);

	useEffect(() => setFailed(false), [location.pathname, location.search]);
	return failed;
}
