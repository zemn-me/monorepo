(() => {
	const el = id => document.getElementById(id);
	const managing = document.body.hasAttribute('data-manage');
	let authenticated = false;
	let issues = [];
	let busy = false;
	let loginToken = new URLSearchParams(location.hash.slice(1)).get('login');
	if (loginToken) history.replaceState(null, '', location.pathname);

	async function api(
		path,
		body,
		method = body === undefined ? 'GET' : 'POST'
	) {
		const response = await fetch(path, {
			method,
			credentials: 'same-origin',
			cache: 'no-store',
			...(body === undefined
				? {}
				: {
						headers: { 'Content-Type': 'application/json' },
						body: JSON.stringify(body),
					}),
		});
		const data = await response.json();
		if (!response.ok) throw new Error(data.error || 'Please try again.');
		return data;
	}
	function errorText(error) {
		return error instanceof Error ? error.message : 'Please try again.';
	}
	function button(text, action) {
		const node = document.createElement('button');
		node.type = 'button';
		node.className = 'text-button';
		node.textContent = text;
		node.addEventListener('click', action);
		return node;
	}
	// Public and management pages use this same row, with author controls appended.
	function renderIssue(issue) {
		const row = document.createElement('li');
		row.id = `issue-${issue.number}`;
		const line = document.createElement('div');
		line.className = 'issue-line';
		const title = document.createElement('h3');
		title.textContent = `Issue ${issue.number}`;
		line.append(title);
		if (issue.pdf) {
			const link = document.createElement('a');
			link.href = `/api/issues/${issue.number}/pdf`;
			link.target = '_blank';
			link.rel = 'noopener noreferrer';
			link.textContent = 'Read';
			link.setAttribute(
				'aria-label',
				`Read issue ${issue.number} (opens in a new tab)`
			);
			line.append(link);
		}
		row.append(line);
		if (managing && authenticated) row.append(editor(issue));
		return row;
	}
	function render() {
		el('issue-list').replaceChildren(...issues.map(renderIssue));
		if (managing)
			el('issue-number').value = Math.min(
				9999,
				Math.max(0, ...issues.map(i => i.number)) + 1
			);
	}
	async function loadIssues() {
		issues = (await api('/api/issues')).issues;
		render();
		el('archive-status').textContent = '';
	}
	function authState(value) {
		authenticated = value;
		el('author-panel').hidden = value;
		el('logout').hidden = !value;
		el('add-issue').hidden = !value;
		el('editing-note').hidden = !value;
		render();
	}
	async function edit(action, message) {
		if (busy) return;
		busy = true;
		const controls = document.querySelectorAll(
			'.issue-controls button, .issue-controls input, #add-issue button, #add-issue input, #logout'
		);
		for (const control of controls) control.disabled = true;
		el('edit-status').textContent = 'Saving…';
		try {
			await action();
			el('edit-status').textContent = message;
			try {
				await loadIssues();
			} catch {
				el('archive-status').textContent =
					'Changes saved. Reload to refresh the issue list.';
			}
		} catch (error) {
			el('edit-status').textContent = errorText(error);
		} finally {
			busy = false;
			for (const control of controls) control.disabled = false;
		}
	}
	function editor(issue) {
		const controls = document.createElement('div');
		controls.className = 'issue-controls';
		const details = document.createElement('details');
		const summary = document.createElement('summary');
		summary.textContent = issue.pdf ? 'Replace PDF' : 'Upload PDF';
		const form = document.createElement('form');
		const label = document.createElement('label');
		label.htmlFor = `pdf-${issue.number}`;
		label.textContent = `PDF for issue ${issue.number}`;
		const input = document.createElement('input');
		input.type = 'file';
		input.id = label.htmlFor;
		input.accept = 'application/pdf,.pdf';
		input.required = true;
		const help = document.createElement('p');
		help.id = `pdf-help-${issue.number}`;
		help.textContent = 'Up to 50 MB.';
		input.setAttribute('aria-describedby', help.id);
		const upload = document.createElement('button');
		upload.type = 'submit';
		upload.textContent = summary.textContent;
		form.append(label, input, help, upload);
		form.addEventListener('submit', event => {
			event.preventDefault();
			const file = input.files[0];
			if (
				!file ||
				!file.name.toLowerCase().endsWith('.pdf') ||
				file.size < 5 ||
				file.size > 50 * 1024 * 1024
			) {
				el('edit-status').textContent = 'Choose a PDF up to 50 MB.';
				return;
			}
			void edit(async () => {
				el('edit-status').textContent =
					`Uploading PDF for issue ${issue.number}…`;
				const prepared = await api('/api/uploads', {
					number: issue.number,
					size: file.size,
				});
				const body = new FormData();
				for (const [key, value] of Object.entries(prepared.fields))
					body.append(key, value);
				body.append('file', file);
				const response = await fetch(prepared.url, {
					method: 'POST',
					body,
					credentials: 'omit',
				});
				if (!response.ok)
					throw new Error('The upload failed. Please try again.');
				el('edit-status').textContent = 'Publishing…';
				await api(`/api/uploads/${prepared.id}/publish`, {});
			}, `Issue ${issue.number} is published.`);
		});
		details.append(summary, form);
		controls.append(details);
		if (issue.pdf)
			controls.append(
				button('Remove PDF', () =>
					edit(
						() =>
							api(
								`/api/issues/${issue.number}/pdf`,
								undefined,
								'DELETE'
							),
						`PDF removed from issue ${issue.number}.`
					)
				)
			);
		controls.append(
			button('Delete issue', () =>
				edit(
					() =>
						api(`/api/issues/${issue.number}`, undefined, 'DELETE'),
					`Issue ${issue.number} deleted.`
				)
			)
		);
		return controls;
	}
	async function start() {
		void loadIssues().catch(() => {
			el('archive-status').textContent =
				'Couldn’t load the issues. Please reload to try again.';
		});
		if (!managing) {
			try {
				const session = await api('/api/session');
				el('show-edit').hidden = !session.authenticated;
				el('show-login').hidden = session.authenticated;
			} catch {
				// Keep the login link available if session lookup fails.
			}
			return;
		}
		el('add-issue').addEventListener('submit', event => {
			event.preventDefault();
			const number = Number(el('issue-number').value);
			void edit(
				() => api('/api/issues', { number }),
				`Issue ${number} added.`
			);
		});
		el('login-form').addEventListener('submit', async event => {
			event.preventDefault();
			const submit = event.target.querySelector('button');
			submit.disabled = true;
			el('login-status').textContent = 'Sending…';
			try {
				await api('/api/login', { email: el('email').value });
				el('login-status').textContent =
					'If this is the author’s email, a login link is on its way. The email shows when its 12-hour login window ends.';
			} catch (error) {
				el('login-status').textContent = errorText(error);
			} finally {
				submit.disabled = false;
			}
		});
		el('confirm-login').addEventListener('click', async () => {
			el('confirm-login').disabled = true;
			try {
				await api('/api/login/confirm', { token: loginToken });
				loginToken = null;
				authState(true);
			} catch (error) {
				el('login-status').textContent = errorText(error);
				loginToken = null;
				el('confirm-login').hidden = true;
				el('login-form').hidden = false;
			} finally {
				el('confirm-login').disabled = false;
			}
		});
		el('logout').addEventListener('click', async () => {
			el('logout').disabled = true;
			try {
				await api('/api/logout', {});
				authState(false);
				el('login-status').textContent = '';
				el('edit-status').textContent = '';
				el('confirm-login').hidden = true;
				el('login-form').hidden = false;
				el('email').focus();
			} catch (error) {
				el('edit-status').textContent = errorText(error);
			} finally {
				el('logout').disabled = false;
			}
		});
		if (loginToken) {
			el('login-form').hidden = true;
			el('confirm-login').hidden = false;
			el('login-status').textContent =
				'Confirm to log in and manage issues.';
			el('confirm-login').focus();
		} else {
			try {
				authState((await api('/api/session')).authenticated);
			} catch {
				el('login-status').textContent =
					'Login is temporarily unavailable. Please try again.';
			}
		}
	}
	void start();
})();
