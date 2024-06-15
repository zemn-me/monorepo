import { BaseUriDirective, Directive, DirectiveName, ExternalDirective, FetchDirectiveName, FormActionDirective, FrameAncestorsDirective, HashAlgorithm, HashSource, Host, HostSource, KeywordSource, NavigationDirective, NoncePrefix, NonceSource, OtherDirectiveName, Path, Port, ReportToDirective, ReportUriDirective, ReportingDirective, SandboxDirective, Scheme, SchemeSource, UriReference, WebRtcDirective, Wildcard, WorkerSrcDirective } from "#root/project/zemn.me/app/experiments/csp/ast.js";
import { z } from "zod";


const SingleQuotedValue = z.string().refine(v => v.startsWith("'") && v.endsWith("'"))
	.transform(s => s.slice(1, -1))

const SingleQuotedPrefixedvalue = SingleQuotedValue.transform(s => s.split(/-/g, 2));

export const SerializedNonceSource = SingleQuotedPrefixedvalue.pipe(
	z.tuple([NoncePrefix, z.string()]).transform(([, v]) => ({ nonce: v })).pipe(NonceSource)
)

export const SerializedHashSource = SingleQuotedPrefixedvalue.transform(([hashAlgorithm, value]) =>
	({ hashAlgorithm, value })).pipe(HashSource)

export const SerializedKeywordSource = KeywordSource;

export const SerializedSchemeSource = z.string().refine(
	s => /^[a-zA-Z][a-zA-Z\-]*:$/.test(s)
).transform(scheme => ({ scheme: scheme.slice(0, -1) })).pipe(SchemeSource);

const wildcardStr = "*";
const wildcardPrefixStr = "*."
const trailingDotStr = ".";

export const SerializedHost = z.string().transform(s => {
	if (s === wildcardStr) return "*";
	const wildcardPrefix = s.startsWith(wildcardPrefixStr);
	if (wildcardPrefix) s = s.slice(0, wildcardPrefixStr.length);

	const trailingDot = s.endsWith(trailingDotStr);
	if (trailingDot) s = s.slice(0, -trailingDotStr.length);

	const hostnameParts = s.split(/\./g);

	return { wildcardPrefix, trailingDot, hostnameParts }
}).pipe(Host);

export const SerializedHostSource = z.string().transform(s => {
	// chatgpt generated this and I am not to question it.
	const match = /^(?:(?<scheme>[a-zA-Z][a-zA-Z0-9+.-]*):\/\/)?(?<host>(?:\*\.)?(?:[a-zA-Z0-9-]+\.)*[a-zA-Z0-9-]+)(?::(?<port>\d+|\*))?(?<path>\/[^;,]*)?(?<query>\?[^#\s]*)?(?<fragment>#[^\s]*)?$/.exec(s);
	if (match === null) return match;

	const { scheme, host, port, path, query, fragment } = match.groups as { scheme: string, host: string, port: string, path: string, query: string, fragment: string };

	return { scheme, host, port, path, query, fragment }
}).pipe(HostSource.merge(z.strictObject({
	host: SerializedHost,
}))).pipe(HostSource);


export const SerializedSource = z.string().pipe(z.union([
	SerializedSchemeSource, SerializedHostSource, SerializedKeywordSource, SerializedNonceSource, SerializedHashSource
]))

export const SerializedSourceList = z.string().transform(v => v.split(/\s+/g))
	.pipe(SerializedSource.array());

export const PartiallySerializedSourceListedDirective = z.strictObject({
	name: z.union([
		FetchDirectiveName,
		WorkerSrcDirective.shape.name,
		BaseUriDirective.shape.name,
		FormActionDirective.shape.name,
	]),
	value: SerializedSourceList
}).pipe(Directive);

export const SerializedAncestorSource = SerializedSchemeSource.or(SerializedHostSource).or(z.literal("'self'"))

export const PartiallySerializedFrameAncestorsDirective = FrameAncestorsDirective.merge(z.strictObject({
	value: z.string().transform(v => v.split(/ /g)).pipe(SerializedAncestorSource.array())
})).pipe(FrameAncestorsDirective);

export const PartiallySerializedReportUriDirective = ReportUriDirective.merge(z.strictObject({
	value: z.string().transform(v => v.split(" ")).pipe(ReportUriDirective.shape.value)
}));

export const SerializedDirective = z.string().transform(
	s => {
		const [name, value] = s.split(/\s+/g, 2)

		return { name, value }
	}
).pipe(z.union([
	PartiallySerializedSourceListedDirective,
 WebRtcDirective,
 SandboxDirective,
	ReportToDirective,
	PartiallySerializedReportUriDirective,
	ExternalDirective,
	PartiallySerializedFrameAncestorsDirective,
]))

export const SerializedPolicy = z.string().transform(
	s => s.split(";").map(v => v.trim())
).pipe(SerializedDirective.array())
