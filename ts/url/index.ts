const isSafeUrl = Symbol();

const errInvalidProtocol = Symbol('error: invalid protocol');

// eslint-disable-next-line @typescript-eslint/no-unsafe-declaration-merging
export interface URL extends globalThis.URL {
	[isSafeUrl]: true;
}

abstract class Safe extends globalThis.URL implements URL {
	private allowedProtocols = ['http:', 'https:', 'tel:', 'mailto:'];
	[isSafeUrl] = true as const;
	constructor(url: string, base?: string) {
		super(url, base);

		const err = this.isSafe();
		if (err) throw err;
	}

	private isSafe(): Error | void {
		if (!this.allowedProtocols.includes(this.protocol))
			return new Error(errInvalidProtocol.toString());
	}
}

export class Local extends Safe implements URL {
	static New(params: TemplateStringsArray) {
		const [url] = params;
		return new this(url);
	}
	override [isSafeUrl] = true as const;
	constructor(url: string) {
		super(url, process.env['DEPLOY_DOMAIN']);
	}
}

// eslint-disable-next-line @typescript-eslint/no-unsafe-declaration-merging
export class URL extends Safe implements URL {
	static New(params: TemplateStringsArray) {
		const [url] = params;
		return new this(url);
	}
}
