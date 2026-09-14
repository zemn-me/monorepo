import style from '#root/project/me/zemn/app/journal/style.module.css';
import { ZEMN_ME_API_BASE } from '#root/project/me/zemn/constants/constants.js';

export function JournalMCPSetup() {
	const endpoint = new URL('/journal/mcp', ZEMN_ME_API_BASE).toString();
	const tokenEndpoint = new URL('/oauth2/token', ZEMN_ME_API_BASE).toString();

	return (
		<details className={style.mcpSetup}>
			<summary>Connect your journal to an MCP client</summary>
			<p>
				Let a compatible AI client search your journal and read transcripts
				and summaries with citations. The MCP tools are read-only.
			</p>
			<ol>
				<li>
					Add a remote MCP server in your client and choose Streamable
					HTTP as the transport. Use this server URL:
					<pre><code>{endpoint}</code></pre>
				</li>
				<li>
					Use a zemn.me token from the existing OAuth token exchange
					described below. Choose bearer-token authentication and enter
					the returned <code>access_token</code> in your client’s token
					field. If your client uses custom headers, set{' '}
					<code>Authorization</code> to:
					<pre><code>{'Bearer <your zemn.me token>'}</code></pre>
				</li>
				<li>
					Connect, then try asking “What did I write about last week?”
					The available tools are <code>search_journal</code>,{' '}
					<code>get_journal_entry</code>, and{' '}
					<code>list_journal_summaries</code>.
				</li>
			</ol>
			<p>
				Access requires the journal owner’s account and the existing{' '}
				<code>journal_read</code> permission. Your client must accept a
				bearer token; automatic OAuth browser sign-in is not supported
				yet. If the token expires, repeat the token exchange and replace
				it in your client.
			</p>
			<details>
				<summary>OAuth token exchange</summary>
				<p>
					This is the same exchange used by the website’s sign-in flow.
					It requires a valid Google ID token issued for the zemn.me
					sign-in client and the journal owner’s account. A Google
					access token or a token issued for another app will not work.
				</p>
				<p>
					Send a POST request to <code>{tokenEndpoint}</code> with{' '}
					<code>Content-Type: application/x-www-form-urlencoded</code>{' '}
					and these fields:
				</p>
				<pre><code>{[
					'grant_type=urn:ietf:params:oauth:grant-type:token-exchange',
					'subject_token_type=urn:ietf:params:oauth:token-type:id_token',
					'requested_token_type=urn:ietf:params:oauth:token-type:id_token',
					'subject_token=<your Google ID token>',
				].join('\n')}</code></pre>
				<p>
					Form-encode the fields. Use the response’s{' '}
					<code>access_token</code> as your MCP bearer token;{' '}
					<code>expires_in</code> gives its lifetime in seconds. The
					MCP endpoint does not accept the original Google token.
				</p>
			</details>
			<p>
				The exchanged token carries your existing zemn.me account
				permissions, which may include other account actions. Store it
				in your client’s credential settings and use a client you trust.
			</p>
		</details>
	);
}
