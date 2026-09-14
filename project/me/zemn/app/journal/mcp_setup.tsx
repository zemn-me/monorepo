import style from '#root/project/me/zemn/app/journal/style.module.css';
import { ZEMN_ME_API_BASE } from '#root/project/me/zemn/constants/constants.js';

export function JournalMCPSetup() {
	const endpoint = new URL('/journal/mcp', ZEMN_ME_API_BASE).toString();
	return (
		<details className={style.mcpSetup}>
			<summary>Connect your journal to an MCP client</summary>
			<p>
				Let a compatible AI client search your journal and read
				transcripts and summaries with citations. The MCP tools are
				read-only.
			</p>
			<ol>
				<li>
					Add a remote MCP server in your client. Choose Streamable
					HTTP and use this server URL:
					<pre>
						<code>{endpoint}</code>
					</pre>
				</li>
				<li>
					Choose OAuth authentication. Your client registers
					automatically; no client ID, client secret, or copied token
					is needed.
				</li>
				<li>
					Sign in to zemn.me in the browser window that opens. Check
					the client name and return address, then choose “Allow
					journal access”.
				</li>
				<li>
					Return to your client and try asking “What did I write about
					last week?”
				</li>
			</ol>
			<p>
				Access requires the journal owner’s account and the same{' '}
				<code>journal_read</code> permission used by the diary. Only
				connect clients you trust with your private entries.
			</p>
			<p>
				Connections can renew automatically for up to 30 days when the
				client supports refresh tokens. After that, sign in again.
				Clients can revoke the connection through OAuth revocation.
			</p>
			<p>
				If no sign-in window opens, check that your client supports
				remote MCP with OAuth and automatic client registration. Both
				dynamic registration and Client ID Metadata Documents are
				supported.
			</p>
		</details>
	);
}
