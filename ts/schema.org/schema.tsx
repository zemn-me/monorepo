import { useSyncExternalStore } from 'react';
import { Thing, WithContext } from 'schema-dts';

export interface SchemaProps<T extends Thing> {
	readonly children: WithContext<T>;
}

const subscribe = () => () => undefined;
const clientSnapshot = () => true;
const serverSnapshot = () => false;

/** Declare schema.org data without parsing HTML or assigning script strings. */
export function Schema<T extends Thing>({ children }: SchemaProps<T>) {
	const client = useSyncExternalStore(subscribe, clientSnapshot, serverSnapshot);
	const json = JSON.stringify(children);
	return (
		<script
			key={client ? 'client' : 'server'}
			suppressHydrationWarning
			type="application/ld+json"
		>
			{/* Keep SSR data through hydration even if client metadata differs.
			    An array makes React create a DOM text node on the client.
			    Remount after hydration to avoid clearing script.textContent. */}
			{client ? [json] : json}
		</script>
	);
}
