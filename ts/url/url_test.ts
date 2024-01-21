import * as Url from '.';

describe('url', () => {
	describe('LocalURL', () => {
		it('should throw when DEPLOY_DOMAIN is unset', () => {
			expect(() => new Url.Local('/something')).toThrow();
		});

		it('should work with template syntax', () => {
			// eslint-disable-next-line no-unused-expressions
			Url.Local.New`https://google.com`;
		});

		it('should not throw when DEPLOY_DOMAIN is set', () => {
			try {
				process.env['DEPLOY_DOMAIN'] = 'https://something.com';
				expect(() => new Url.Local('/something')).not.toThrow();
			} finally {
				delete process.env.DEPLOY_DOMAIN;
			}
		});

		it('should not allow javascript URIs', () => {
			try {
				process.env['DEPLOY_DOMAIN'] = 'javascript://alert(1)';
				expect(() => new Url.Local('/something')).toThrow();
			} finally {
				delete process.env.DEPLOY_DOMAIN;
			}
		});
	});

	describe('URL', () => {
		it('should work with template syntax', () => {
			// eslint-disable-next-line no-unused-expressions
			Url.URL.New`https://google.com`;
		});
		it('should not allow javascript URIs', () => {
			try {
				process.env['DEPLOY_DOMAIN'] = 'javascript://alert(1)';
				expect(() => new Url.URL('javascript://alert(1)')).toThrow();
			} finally {
				delete process.env.DEPLOY_DOMAIN;
			}
		});
		it('should not allow random protocol URIs', () => {
			try {
				process.env['DEPLOY_DOMAIN'] = 'javascript://alert(1)';
				expect(() => new Url.URL('skype://alert(1)')).toThrow();
			} finally {
				delete process.env.DEPLOY_DOMAIN;
			}
		});
		it.each([
			'http://google.com',
			'https://myspace.co',
			'tel:+4482349284590',
			'mailto:thomas@cool.com',
		] as const)('should allow %s', url => {
			try {
				process.env['DEPLOY_DOMAIN'] = url;
				expect(() => new Url.URL(url)).not.toThrow();
			} finally {
				delete process.env.DEPLOY_DOMAIN;
			}
		});
		it.each([
			'skype://coolo',
			'steam://run/440',
			'javascripT://%0Aalert(1)',
		] as const)('should not allow %s', url => {
			try {
				process.env['DEPLOY_DOMAIN'] = url;
				expect(() => new Url.URL(url)).toThrow();
			} finally {
				delete process.env.DEPLOY_DOMAIN;
			}
		});
	});
});
