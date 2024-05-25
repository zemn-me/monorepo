import { BaseUriDirective, DirectiveName, FetchDirectiveName, FormActionDirective, HashAlgorithm, HashSource, Host, HostSource, KeywordSource, NoncePrefix, NonceSource, OtherDirectiveName, Path, Port, Scheme, SchemeSource, WorkerSrcDirective } from "#root/project/zemn.me/app/experiments/csp/ast.js";
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

export const SerializedSchemeSource = z.string().transform(scheme => ({ scheme })).pipe(SchemeSource);

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
	const match = /^(?:(?<scheme>[a-zA-Z][a-zA-Z0-9+.-]*):\/\/)?(?<host>(?:\*\.)?(?:[a-zA-Z0-9-]+\.)*[a-zA-Z0-9-]+)(?::(?<port>\d+|\*))?(?<path>\/[^;,]*)?$/.exec(s);
	if (match === null) return match;

	const { scheme, host, port, path } = match.groups as { scheme: string, host: string, port: string, path: string };

	return { scheme, host, port, path }
}).pipe(z.strictObject({
	scheme: Scheme.optional(),
	host: SerializedHost,
	port: Port.optional(),
	path: Path.optional()
})).pipe(HostSource);


export const SerializedSource = z.string().pipe(z.union([
	SerializedSchemeSource, SerializedHostSource, SerializedKeywordSource, SerializedNonceSource, SerializedHashSource
]))

export const SerializedSourceList = z.string().transform(v => v.split(/\s+/g))
	.pipe(SerializedSource.array());


export const PartiallySerializedSourceListedDirective = z.tuple([
	z.union([
		FetchDirectiveName,
		WorkerSrcDirective.shape.name,
		BaseUriDirective.shape.name,
		FormActionDirective.shape.name,
	]),
	SerializedSourceList
])


export const SerializedDirective = z.string().transform(
	s => s.split(/\s+/g, 2)
).pipe(PartiallySerializedSourceListedDirective)

export const SerializedPolicy = z.string().transform(
	s => s.split(";").map(v => v.trim())
).pipe(SerializedDirective.array())
