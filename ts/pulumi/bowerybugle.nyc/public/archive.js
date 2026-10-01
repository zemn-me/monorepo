(() => {
	const el = id => document.getElementById(id);
	const list = el('issue-list');
	let issues = [];
	let loginToken = new URLSearchParams(location.hash.slice(1)).get('login');
	if (loginToken) history.replaceState(null, '', location.pathname);

	async function api(path, body) {
		const response = await fetch(path, {
			method: body === undefined ? 'GET' : 'POST',
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
	function authState(authenticated) {
		el('upload-panel').hidden = !authenticated;
		el('show-login').hidden = authenticated;
		el('author-panel').hidden = true;
		el('show-login').setAttribute('aria-expanded', 'false');
	}
	function uploadLabel() {
		el('publish').textContent = issues.some(
			issue =>
				issue.number === Number(el('issue-number').value) && issue.pdf
		)
			? 'Replace PDF'
			: 'Upload PDF';
	}
	async function loadIssues() {
		const data = await api('/api/issues');
		issues = data.issues;
		list.replaceChildren(
			...issues.map(issue => {
				const row = document.createElement('li');
				const title = document.createElement('h3');
				title.textContent = `Issue ${issue.number}`;
				const pdf = document.createElement(issue.pdf ? 'a' : 'span');
				if (issue.pdf) {
					pdf.href = `/api/issues/${issue.number}/pdf`;
					pdf.target = '_blank';
					pdf.rel = 'noopener noreferrer';
					pdf.textContent = 'Read PDF ↗';
					pdf.setAttribute(
						'aria-label',
						`Read issue ${issue.number} PDF (opens in a new tab)`
					);
				} else {
					pdf.textContent = 'PDF not uploaded';
				}
				row.append(title, pdf);
				return row;
			})
		);
		el('archive-status').textContent = '';
		uploadLabel();
	}
	el('show-login').addEventListener('click', () => {
		const panel = el('author-panel');
		panel.hidden = !panel.hidden;
		el('show-login').setAttribute('aria-expanded', String(!panel.hidden));
		if (!panel.hidden) el(loginToken ? 'confirm-login' : 'email').focus();
	});
	el('login-form').addEventListener('submit', async event => {
		event.preventDefault();
		const button = event.target.querySelector('button');
		button.disabled = true;
		el('login-status').textContent = 'Sending…';
		try {
			await api('/api/login', { email: el('email').value });
			el('login-status').textContent =
				'If this is the author’s email, a login link is on its way. The email shows when its 12-hour login window ends.';
		} catch (error) {
			el('login-status').textContent = errorText(error);
		} finally {
			button.disabled = false;
		}
	});
	el('confirm-login').addEventListener('click', async () => {
		el('confirm-login').disabled = true;
		try {
			await api('/api/login/confirm', { token: loginToken });
			loginToken = null;
			authState(true);
			el('issue-number').focus();
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
			el('confirm-login').hidden = true;
			el('login-form').hidden = false;
			el('show-login').focus();
		} catch (error) {
			el('upload-status').textContent = errorText(error);
		} finally {
			el('logout').disabled = false;
		}
	});
	el('issue-number').addEventListener('input', uploadLabel);
	el('upload-form').addEventListener('submit', async event => {
		event.preventDefault();
		const file = el('pdf').files[0];
		const status = el('upload-status');
		if (
			!file ||
			!file.name.toLowerCase().endsWith('.pdf') ||
			file.size < 5 ||
			file.size > 50 * 1024 * 1024
		) {
			status.textContent = 'Choose a PDF up to 50 MB.';
			return;
		}
		// Freeze the selected issue for the entire upload, including a replacement.
		const number = Number(el('issue-number').value);
		el('publish').disabled = true;
		el('issue-number').disabled = true;
		el('pdf').disabled = true;
		status.textContent = 'Uploading PDF…';
		try {
			const upload = await api('/api/uploads', {
				number,
				size: file.size,
			});
			const form = new FormData();
			for (const [key, value] of Object.entries(upload.fields))
				form.append(key, value);
			form.append('file', file);
			const response = await fetch(upload.url, {
				method: 'POST',
				body: form,
				credentials: 'omit',
			});
			if (!response.ok)
				throw new Error('The upload failed. Please try again.');
			status.textContent = 'Publishing…';
			await api(`/api/uploads/${upload.id}/publish`, {});
			el('pdf').value = '';
			status.textContent = `Issue ${number} is published.`;
			try {
				await loadIssues();
			} catch {
				el('archive-status').textContent =
					'The PDF is published. Reload to refresh the issue list.';
			}
		} catch (error) {
			status.textContent = errorText(error);
		} finally {
			el('publish').disabled = false;
			el('issue-number').disabled = false;
			el('pdf').disabled = false;
		}
	});
	async function start() {
		void loadIssues().catch(() => {
			el('archive-status').textContent =
				'Couldn’t load the PDFs. Please reload to try again.';
		});
		if (loginToken) {
			el('author-panel').hidden = false;
			el('login-form').hidden = true;
			el('confirm-login').hidden = false;
			el('show-login').setAttribute('aria-expanded', 'true');
			el('login-status').textContent =
				'Confirm to log in and upload issues.';
			el('confirm-login').focus();
		} else {
			try {
				const session = await api('/api/session');
				authState(session.authenticated);
			} catch {
				el('login-status').textContent =
					'Login is temporarily unavailable. Please try again.';
			}
		}
	}
	void start();
})();
