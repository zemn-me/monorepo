/**
 * @fileoverview processing and validation for CSP level 3.
 */

import { z } from "zod";


export const Scheme = z.string().refine(
	s => /[A-Za-z0-9+\-\.]*/.test(s)
).describe("RFC 3986 scheme")

export const SchemeSource = z.strictObject({
	scheme: Scheme
});

export const Wildcard = z.literal("*").describe("wildcard")
export const Host = z.union([
	Wildcard,
	z.strictObject({
		/**
		 * *.google.com
		 */
		wildcardPrefix: z.boolean().describe("*.google.com, *.something.example.com, etc"),
		hostnameParts: z.string().array().describe(`["google", "com"]`),
		trailingDot: z.boolean(),
	})
])

export const Port = z.union([z.number(), Wildcard]);

export const Path = z.strictObject({
	parts: z.string().array().describe("a/b/c"),
	absolute: z.boolean()
})

export const HostSource = z.strictObject({
	scheme: Scheme.optional(),
	host: Host,
	port: Port.optional(),
	path: Path.optional(),
	query: z.string().optional(),
	fragment: z.string().optional()
});

export const NoncePrefix = z.literal('nonce-');

export const NonceSource = z.strictObject({
	nonce: z.string().describe("some random characters")
});

export const Base64Value = z.string().refine(
	s => /(?:[A-Za-z0-9\+\/\-\_]{2}){1,}={2}/.test(s), { message: 'must be valid base64'  }
)

export const HashAlgorithm = z.enum(['sha256', 'sha384', 'sha512']) ;

export const HashSource = z.strictObject({
	hashAlgorithm: HashAlgorithm,
	value: Base64Value,
})

export const KeywordSource = z.enum([
	"'self'",
	"'unsafe-inline'",
	"'unsafe-eval'",
	"'strict-dynamic'",
	"'unsafe-hashes'",
	"'report-sample'",
	"'unsafe-allow-redirects'",
	"'wasm-unsafe-eval'"
]);

export const Source = z.union([
	SchemeSource, HostSource, KeywordSource, NonceSource, HashSource
]);

export const SourceList = Source.array();

export const FetchDirectiveName = z.enum([
		'child-src',
		'connect-src',
		'default-src',
		'font-src',
		'frame-src',
		'img-src',
		'manifest-src',
		'media-src',
		'object-src',
		'script-src',
		'script-src-elem',
		'script-src-attr',
		'style-src',
		'style-src-elem',
		'style-src-attr',
])

export const FetchDirective = z.strictObject({
	name: FetchDirectiveName,
	value: SourceList
});

export const OtherDirectiveName = z.enum([
	'webrtc',
	'worker-src'
]);

export const WebRtcDirective = z.strictObject({
	name: z.literal(OtherDirectiveName.enum.webrtc),
	value: z.enum([ 'allow', 'block' ])
});

export const WorkerSrcDirective = z.strictObject({
	name: z.literal(OtherDirectiveName.enum["worker-src"]),
	value: SourceList
});

export const OtherDirective = z.union([
	WebRtcDirective,
	WorkerSrcDirective
]);

export const DocumentDirectiveName = z.enum([
'base-uri', 'sandbox'
]);

export const BaseUriDirective = z.strictObject({
	name: z.literal(DocumentDirectiveName.enum["base-uri"]),
	value: SourceList,
});

export const IframeSandboxAttribute = z.enum([
	'allow-downloads',
	'allow-forms',
	'allow-modals',
	'allow-orientation-lock',
	'allow-popups',
	'allow-popups-to-escape-sandbox',
	'allow-presentation',
	'allow-same-origin',
	'allow-scripts',
	'allow-top-navigation',
	'allow-top-navigation-by-user-activation',
	'allow-top-navigation-to-custom-protocols',
])

export const SandboxDirective = z.strictObject({
	name: z.literal(DocumentDirectiveName.enum.sandbox),
	value: IframeSandboxAttribute
})

export const DocumentDirective = z.union([
	BaseUriDirective,
	SandboxDirective
]);

export const NavigationDirectiveName = z.enum([
	'form-action',
	'frame-ancestors'
])

export const FormActionDirective = z.strictObject({
	name: z.literal(NavigationDirectiveName.enum["form-action"]),
	value: SourceList,
})

export const AncestorSource = SchemeSource.or(HostSource).or(z.literal("'self"))

export const AncestorSourceList =
	AncestorSource.array().or(z.literal("'none'"))

export const FrameAncestorsDirective = z.strictObject({
	name: z.literal(NavigationDirectiveName.enum["frame-ancestors"]),
	value: AncestorSourceList
});

export const NavigationDirective =
	FormActionDirective.or(FrameAncestorsDirective)

export const ReportingDirectiveName = z.enum([
	'report-to',
	'report-uri'
])

export const UriReference = z.string().url();

export const ReportUriDirective = z.strictObject({
	name: z.literal(ReportingDirectiveName.enum["report-uri"]),
	value: UriReference.array()
});

export const Token = z.string().refine(
	v => /[!#$%&'*+\-.^_`|~0-9A-Za-z]+/g.test(v)
)

export const ReportToDirective = z.strictObject({
	name: z.literal(ReportingDirectiveName.enum['report-to']),
	value: Token
})

export const ReportingDirective = ReportUriDirective.or(ReportToDirective)

export const ExternalDirectiveName = z.enum([
	'block-all-mixed-content',
	'upgrade-insecure-requests'
])

export const BlockAllMixedContentDirective = z.strictObject({
	name: z.literal(ExternalDirectiveName.enum["block-all-mixed-content"])
});

export const UpgradeInsecureRequestsDirective = z.strictObject({
	name: z.literal(ExternalDirectiveName.enum["upgrade-insecure-requests"])
});

export const ExternalDirective = BlockAllMixedContentDirective.or(UpgradeInsecureRequestsDirective)

export const DirectiveName = z.enum([
	...FetchDirectiveName.options,
	...OtherDirectiveName.options,
	...DocumentDirectiveName.options,
	...ReportingDirectiveName.options,
	...ExternalDirectiveName.options,
])

export const Directive = z.union([
	FetchDirective,
	OtherDirective,
	DocumentDirective,
	NavigationDirective,
	ReportingDirective,
	ExternalDirective
]);
export type Directive = z.TypeOf<typeof Directive>

export const ContentSecurityPolicy = Directive.array();
export type ContentSecurityPolicy = z.TypeOf<typeof ContentSecurityPolicy>


export type DirectiveName = z.TypeOf<typeof Directive>["name"]
