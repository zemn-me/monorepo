import { BaseUriDirective, DirectiveName, FetchDirectiveName, FormActionDirective, HashAlgorithm, HashSource, KeywordSource, NoncePrefix, NonceSource, OtherDirectiveName, Scheme, SchemeSource, WorkerSrcDirective } from "#root/project/zemn.me/app/experiments/csp/ast.js";
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

export const SerializedHostSource = z.string().transform(s => {
	const hostSourceRegex = /^(?:(?<scheme>[a-zA-Z][a-zA-Z0-9+.-]*):\/\/)?(?<host>(?:\*\.)?(?:[a-zA-Z0-9-]+\.)*[a-zA-Z0-9-]+)(?::(?<port>\d+|\*))?(?<path>\/[^;,]*)?$/;

})


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
).pipe(z.tuple([DirectiveName, z.string()]))
	.transform(([dn, args]) => {

	})


export const SerializedPolicy = z.string().transform(
	s => s.split(";").map(v => v.trim())
).pipe(SerializedDirective.array())
