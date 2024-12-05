import { Thing, WithContext } from "schema-dts";

import { dangerouslyDeclareSafeHTML } from "#root/ts/trusted_types/trusted_types.js";

export interface SchemaProps<T extends Thing> {
	readonly children: WithContext<T>
}

/**
 * Declare a schema.org compliant schema for this page.
 *
 * This function uses {@link dangerouslyDeclareSafeHTML}; I think
 * it might be safe, but I can't prove it yet. So be careful!
 */
export function Schema<T extends Thing>({children}: SchemaProps<T>) {
	return <script
		dangerouslySetInnerHTML={{
			__html:
				dangerouslyDeclareSafeHTML(
					JSON.stringify(children))
				}}
				type="application/ld+json"
			/>
}
