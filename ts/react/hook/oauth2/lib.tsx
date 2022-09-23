/**
 * @module react-oauth2-hook
 */

import * as React from 'react';
import * as oauth2 from './types';

// react-storage-hook.d.ts
import { useStorageState } from 'react-storage-hooks';

import { Map } from 'immutable';
import * as PropTypes from 'prop-types';

export interface Request extends oauth2.AuthorizeRequest {
	response_type: 'implicit'
	client_id: string
}

export interface Client extends oauth2.Client {
	type?: 'public'
}

export interface Server extends oauth2.Server {
	scopes: string[]
	code: string
	authorize_url: URL
}

const 
	tokenScopingKey = "oauth-token",
	stateScopingKey = "oauth-state";

export interface Options {
	client: Client,
	server: Server
}


export function authorizeUrl(opts: Options) {
	return function authorizeUrl(base?: Options["server"]["authorize_url"][number] = opts.server.authorize_url[0]) {
		
	}
}

export function oauth2(opts: Options) {
	return {
		useToken(): [token: string | undefined] {

		},
		authorizeUrl(base?: Options["server"]["authorize_url"][number] = opts.server.authorize_url[0]) {
					
		},
		callback(){}
	}
}


export function useOAuth2Token(opts: Options): [token: OAuthToken | undefined, getAuthorizeUrl: () => string, setToken: (tok: string) => void] {

	const [token, setToken] = useStorageState<string>(
		localStorage, tokenKey(storageKey, {authorizeUrl, scope, clientID} ));

	let [stateToken, setStateToken] = useStorageState<string>(localStorage,
		stateKey(storageKey, { authorizeUrl, scope, clientID}));

	const getAuthorizeUrl = () => {

	}

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
