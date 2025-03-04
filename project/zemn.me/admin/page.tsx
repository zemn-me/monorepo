import { requestOIDC, useOIDC } from "#root/project/zemn.me/app/hook/useOIDC.js";
import { and_then, unwrap_or } from "#root/ts/result_types.js";

export default function admin() {
	const googleAuth = useOIDC("https://accounts.google.com");

	return unwrap_or(and_then(
		googleAuth,
		auth => <>Your token: {auth}</>
	), <button onClick={() => requestOIDC("https://accounts.google.com")}>
		<p>
			You are not authenticated to perform this operation.
		</p>
		<p>
			Please click here to authenticate.
		</p>
	</button>);
}
