/**
 * @module react-oauth2-hook
 */

/**
 *
 */

import * as React from 'react';

// react-storage-hook.d.ts
import { useStorageState } from 'react-storage-hooks';

import { Map } from 'immutable';
import * as PropTypes from 'prop-types';

export interface Options {
	/**
	 * The OAuth authorize URL to retrieve the token from.
	 */
	authorizeUrl: string;
	/**
	 * The OAuth scopes to request.
	 */
	scope?: string[];
	/**
	 * The OAuth `redirect_uri` callback.
	 */
	redirectUri: string;
	/**
	 * The OAuth `client_id` corresponding to the requesting client.
	 */
	clientID: string;

	/**
	 * The unique base key used for storing any data in localStorage
	 */
	storageKey: string
}

/**
 * A JSON-ifiable set of information used to uniquely and securely key a request.
 */
interface Target {
	authorizeUrl: string,
	scope: string[],
	clientID: string[]
}

function targetScopingKey(t: Target): string {
	return JSON.stringify(
		[
			t.authorizeUrl,
			// this wil be used for keying, sorting prevents collisions due to
			// ordering.
			t.scope.sort(),
			t.clientID
		]
	)
}

/**
 * useOAuth2Token is a React hook providing an OAuth2 implicit grant token.
 *
 * When useToken is called, it will attempt to retrieve an existing
 * token by the criteria of `{ authorizeUrl, scopes, clientID }`.
 * If a token by these specifications does not exist, the first
 * item in the returned array will be `undefined`.
 *
 * If the user wishes to retrieve a new token, they can call `getToken()`,
 * a function returned by the second parameter. When called, the function
 * will open a window for the user to confirm the OAuth grant, and
 * pass it back as expected via the hook.
 *
 * The OAuth token must be passed to a static endpoint. As
 * such, the `callbackUrl` must be passed with this endpoint.
 * The `callbackUrl` should render the [[OAuthCallback]] component,
 * which will securely verify the token and pass it back,
 * before closing the window.
 *
 * All instances of this hook requesting the same token and scopes
 * from the same place are synchronised. In concrete terms,
 * if you have many components waiting for a Facebook OAuth token
 * to make a call, they will all immediately update when any component
 * gets a token.
 *
 * Finally, in advanced cases the user can manually overwrite any
 * stored token by capturing and calling the third item in
 * the reponse array with the new value.
 * 
 * @example
 *const SpotifyTracks = () => {
 * const [token, getToken] = useOAuth2Token({
 *     authorizeUrl: "https://accounts.spotify.com/authorize",
 *     scope: ["user-library-read"],
 *     clientID: "abcdefg",
 *     redirectUri: document.location.origin + "/callback"
 * })
 *
 * const [response, setResponse] = React.useState()
 * const [error, setError] = React.useState()
 *
 * // when we get a token, query spotify
 * React.useEffect(() => {
 *     if (token == undefined) {return}
 *     fetch('https://api.spotify.com/v1/me/tracks', {
 *         headers: {
 *             Authorization: `Bearer ${token}`
 *         }
 *     }).then(
 *         json => response.json()
 *     ).then(
 *         data => setResponse(data)
 *     ).catch(
 *         error => setError(error)
 *     )
 * }, [token])
 *
 * if (!token || error) return <div onClick={getToken}> login with Spotify </div>
 *
 *return <div>
 * Your saved tracks on Spotify: {JSON.stringify(response)}
 *</div>
 *}
 */
export function useOAuth2Token(options: Options): [token: OAuthToken | undefined, getToken: getToken, setToken: setToken ]

export function useOAuth2Token({
	authorizeUrl,
	scope = [],
	redirectUri,
	clientID,
	storageKey: string
}: Options): [OAuthToken | undefined, getToken, setToken] {
	const target = {
		authorizeUrl,
		scope,
		clientID,
	};

	const [token, setToken] = useStorage<string>(
		storagePrefix + '-' + JSON.stringify(target)
	);

	let [state, setState] = useStorage<string>(oauthStateName);

	const getToken = () => {
		setState(
			(state = JSON.stringify({
				nonce: cryptoRandomString(),
				target,
			}))
		);

		window.open(
			OAuth2AuthorizeURL({
				scope,
				clientID,
				authorizeUrl,
				state,
				redirectUri,
			})
		);
	};

	return [token, getToken, setToken];
};

/**
 * OAuthToken represents an OAuth2 implicit grant token.
 */
export type OAuthToken = string;

/**
 * getToken is returned by [[useOAuth2Token]].
 * When called, it prompts the user to authorize.
 */
export type getToken = () => void;

/**
 * setToken is returned by [[useOAuth2Token]].
 * When called, it overwrites any stored OAuth token.
 * `setToken(undefined)` can be used to synchronously
 * invalidate all instances of this OAuth token.
 */
export type setToken = (newValue: OAuthToken | undefined) => void;

/**
 * @hidden
 */
const cryptoRandomString = () => {
	const entropy = new Uint32Array(10);
	window.crypto.getRandomValues(entropy);

	return window.btoa([...entropy].join(','));
};

/**
 * @hidden
 */
const OAuth2AuthorizeURL = ({
	scope,
	clientID,
	state,
	authorizeUrl,
	redirectUri,
}: {
	scope: string[];
	clientID: string;
	state: string;
	authorizeUrl: string;
	redirectUri: string;
}) =>
	`${authorizeUrl}?${Object.entries({
		scope: scope.join(','),
		client_id: clientID,
		state,
		redirect_uri: redirectUri,
		response_type: 'token',
	})
		.map(([k, v]) => [k, v].map(encodeURIComponent).join('='))
		.join('&')}`;

/**
 * This error is thrown by the [[OAuthCallback]]
 * when the state token recieved is incorrect or does not exist.
 */
export const ErrIncorrectStateToken = new Error('incorrect state token');

/**
 * This error is thrown by the [[OAuthCallback]]
 * if no access_token is recieved.
 */
export const ErrNoAccessToken = new Error('no access_token');

/**
 * @hidden
 */
const urlDecode = (urlString: string): Map<string, string> =>
	Map(
		urlString
			.split('&')
			.map<[string, string]>((param: string): [string, string] => {
				const sepIndex = param.indexOf('=');
				const k = decodeURIComponent(param.slice(0, sepIndex));
				const v = decodeURIComponent(param.slice(sepIndex + 1));
				return [k, v];
			})
	);

/**
 * @hidden
 */
const OAuthCallbackHandler: React.FunctionComponent<{ children?: React.ReactElement }> = ({ children }) => {
	const [state] = useStorage<string>(oauthStateName);
	const { target } = JSON.parse(state);
	const [, /* token */ setToken] = useStorage(
		storagePrefix + '-' + JSON.stringify(target)
	);

	console.log('rendering OAuthCallbackHandler');

	React.useEffect(() => {
		const params: Map<string, string> = Map([
			...urlDecode(window.location.search.slice(1)),
			...urlDecode(window.location.hash.slice(1)),
		]);

		if (state !== params.get('state')) throw ErrIncorrectStateToken;

		const token: string | undefined = params.get('access_token');
		if (token == undefined) throw ErrNoAccessToken;

		setToken(token);
		window.close();
	}, []);

	return <React.Fragment>{children || 'please wait...'}</React.Fragment>;
};

/**
 * OAuthCallback is a React component that handles the callback
 * step of the OAuth2 protocol.
 *
 * OAuth2Callback is expected to be rendered on the url corresponding
 * to your redirect_uri.
 *
 * By default, this component will deal with errors by closing the window,
 * via its own React error boundary. Pass `{ errorBoundary: false }`
 * to handle this functionality yourself.
 *
 * @example
 * <Route exact path="/callback" component={OAuthCallback} />} />
 */
export const OAuthCallback: React.FunctionComponent<{
	errorBoundary?: boolean;
	children?: React.ReactElement
}> = ({
	/**
	 * When set to true, errors are thrown
	 * instead of just closing the window.
	 */
	errorBoundary = true,
	children,
}) => {
	if (errorBoundary === false)
		return <OAuthCallbackHandler>{children}</OAuthCallbackHandler>;
	return (
		<ClosingErrorBoundary>
			<OAuthCallbackHandler>{children}</OAuthCallbackHandler>
		</ClosingErrorBoundary>
	);
};

OAuthCallback.propTypes = {
	errorBoundary: PropTypes.bool,
};

/**
 * @hidden
 */
class ClosingErrorBoundary extends React.PureComponent<{ children?: React.ReactElement }> {
	state = { errored: false };

	static getDerivedStateFromError(error: string) {
		console.log(error);
		// window.close()
		return { errored: true };
	}

	static propTypes = {
		children: PropTypes.func.isRequired,
	};

	render() {
		return this.state.errored ? null : this.props.children;
	}
}

export default 'this module has no default export.';
