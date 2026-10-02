import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { type ReactNode, useEffect, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router';
import { type Edit, type Issue, useAPI, useEdit } from './api.js';

function Masthead() {
	return (
		<header>
			<div className="masthead">
				<p className="the">The</p>
				<h1 aria-label="The Bowery Bugle">
					{['Bowery', 'Bugle'].map((word, i) => (
						<span key={word} className="word" aria-hidden="true">
							{[...word].map((letter, j) => (
								<b key={`${i}-${j}`}>{letter}</b>
							))}
						</span>
					))}
				</h1>
			</div>
		</header>
	);
}
export function IssueList({
	issues,
	controls,
}: {
	issues: Issue[];
	controls?: (issue: Issue) => ReactNode;
}) {
	const api = useAPI();
	return (
		<ol className="issues" id="issue-list" reversed>
			{issues.map(issue => (
				<li key={issue.number} id={`issue-${issue.number}`}>
					<div className="issue-line">
						<h3>Issue {issue.number}</h3>
						{issue.pdf && (
							<a
								href={api.url(
									`/api/issues/${issue.number}/pdf`
								)}
								target="_blank"
								rel="noopener noreferrer"
								aria-label={`Read issue ${issue.number} (opens in a new tab)`}
							>
								Read
							</a>
						)}
					</div>
					{controls?.(issue)}
				</li>
			))}
		</ol>
	);
}
function IssueControls({
	issue,
	busy,
	edit,
}: {
	issue: Issue;
	busy: boolean;
	edit: (edit: Edit) => void;
}) {
	const label = issue.pdf ? 'Replace PDF' : 'Upload PDF';
	return (
		<div className="issue-controls">
			<details>
				<summary>{label}</summary>
				<form
					onSubmit={event => {
						event.preventDefault();
						const input = event.currentTarget.elements.namedItem(
							'pdf'
						) as HTMLInputElement;
						const file = input.files?.[0];
						if (file instanceof File)
							edit({
								kind: 'upload',
								number: issue.number,
								file,
							});
					}}
				>
					<label htmlFor={`pdf-${issue.number}`}>
						PDF for issue {issue.number}
					</label>
					<input
						id={`pdf-${issue.number}`}
						name="pdf"
						type="file"
						accept="application/pdf,.pdf"
						required
						disabled={busy}
						aria-describedby={`pdf-help-${issue.number}`}
					/>
					<p id={`pdf-help-${issue.number}`}>Up to 50 MB.</p>
					<button type="submit" disabled={busy}>
						{label}
					</button>
				</form>
			</details>
			{issue.pdf && (
				<button
					className="text-button"
					type="button"
					disabled={busy}
					onClick={() =>
						edit({ kind: 'remove', number: issue.number })
					}
				>
					Remove PDF
				</button>
			)}
			<button
				className="text-button"
				type="button"
				disabled={busy}
				onClick={() => edit({ kind: 'delete', number: issue.number })}
			>
				Delete issue
			</button>
		</div>
	);
}
function Login({
	onConfirm,
	pending,
	error,
}: {
	onConfirm: (token: string) => void;
	pending: boolean;
	error: Error | null;
}) {
	const api = useAPI();
	const [token, setToken] = useState<string | null>(null);
	const location = useLocation();
	const navigate = useNavigate();
	useEffect(() => {
		const token = new URLSearchParams(location.hash.slice(1)).get('login');
		if (token) {
			setToken(token);
			void navigate(location.pathname, { replace: true });
		}
	}, [location.hash, location.pathname, navigate]);
	useEffect(() => {
		if (error) setToken(null);
	}, [error]);
	const send = useMutation({
		mutationFn: (email: string) => api.request('/api/login', { email }),
	});
	return (
		<section id="author-panel" aria-label="Author login">
			{token ? (
				<button
					id="confirm-login"
					type="button"
					disabled={pending}
					onClick={() => onConfirm(token)}
				>
					Confirm login
				</button>
			) : (
				<form
					id="login-form"
					onSubmit={event => {
						event.preventDefault();
						send.mutate(
							String(
								new FormData(event.currentTarget).get('email')
							)
						);
					}}
				>
					<label htmlFor="email">Email</label>
					<input
						id="email"
						name="email"
						type="email"
						autoComplete="email"
						required
					/>
					<button type="submit" disabled={send.isPending}>
						Send login link
					</button>
				</form>
			)}
			<p id="login-status" role="status">
				{error?.message ??
					send.error?.message ??
					(send.isPending
						? 'Sending…'
						: send.isSuccess
							? 'If this is the author’s email, a login link is on its way. The email shows when its 12-hour login window ends.'
							: token
								? 'Confirm to log in and manage issues.'
								: '')}
			</p>
		</section>
	);
}
export function Archive({ managing = false }: { managing?: boolean }) {
	const api = useAPI();
	const client = useQueryClient();
	const issues = useQuery(api.issues());
	const session = useQuery(api.session());
	const authenticated = session.data?.authenticated === true;
	const edit = useEdit();
	const auth = useMutation({
		mutationFn: (token: string | null) =>
			token === null
				? api.request<{ authenticated: boolean }>('/api/logout', {})
				: api.request<{ authenticated: boolean }>(
						'/api/login/confirm',
						{ token }
					),
		onSuccess: async data => {
			await client.cancelQueries({ queryKey: api.session().queryKey });
			client.setQueryData(api.session().queryKey, data);
			edit.reset();
		},
	});
	const busy = edit.isPending || auth.isPending;
	const nextNumber = Math.min(
		9999,
		Math.max(0, ...(issues.data?.issues ?? []).map(issue => issue.number)) +
			1
	);
	return (
		<>
			<a className="skip-link" href="#issues">
				Skip to issues
			</a>
			<div className="paper">
				<Masthead />
				{managing && (
					<>
						<nav
							className="management-nav"
							aria-label="Issue management"
						>
							<Link to="/">View site</Link>
							{authenticated && (
								<button
									className="text-button"
									id="logout"
									type="button"
									disabled={busy}
									onClick={() => auth.mutate(null)}
								>
									Log out
								</button>
							)}
						</nav>
						{!authenticated && (
							<Login
								onConfirm={token => auth.mutate(token)}
								pending={auth.isPending}
								error={auth.error}
							/>
						)}{' '}
						{authenticated && (
							<p id="editing-note">
								Changes appear on the site immediately.
							</p>
						)}
						<p id="edit-status" role="status">
							{authenticated
								? (auth.error?.message ??
									edit.error?.message ??
									(edit.isPending
										? edit.variables.kind === 'upload'
											? `Uploading PDF for issue ${edit.variables.number}…`
											: 'Saving…'
										: edit.data))
								: ''}
						</p>
					</>
				)}
				<main id="issues">
					<div className="section-heading">
						<h2>Issues</h2>
					</div>
					<p id="archive-status" role="status">
						{issues.isError
							? 'Couldn’t load the issues. Please reload to try again.'
							: issues.isPending
								? 'Loading issues…'
								: ''}
					</p>
					<IssueList
						issues={issues.data?.issues ?? []}
						controls={
							managing && authenticated
								? issue => (
										<IssueControls
											issue={issue}
											busy={busy}
											edit={value => edit.mutate(value)}
										/>
									)
								: undefined
						}
					/>
					<noscript>
						<p>Enable JavaScript to load the PDFs and log in.</p>
					</noscript>
					{managing && authenticated && (
						<form
							id="add-issue"
							onSubmit={event => {
								event.preventDefault();
								edit.mutate({
									kind: 'add',
									number: Number(
										new FormData(event.currentTarget).get(
											'number'
										)
									),
								});
							}}
						>
							<label htmlFor="issue-number">Issue number</label>
							<div className="add-controls">
								<input
									key={nextNumber}
									id="issue-number"
									name="number"
									type="number"
									min="1"
									max="9999"
									defaultValue={nextNumber}
									required
									disabled={busy}
								/>
								<button type="submit" disabled={busy}>
									Add issue
								</button>
							</div>
						</form>
					)}
				</main>
				<footer>
					{!managing && (
						<Link
							id={authenticated ? 'show-edit' : 'show-login'}
							to="/manage"
						>
							{authenticated ? 'Edit' : 'Log in'}
						</Link>
					)}
				</footer>
			</div>
		</>
	);
}
