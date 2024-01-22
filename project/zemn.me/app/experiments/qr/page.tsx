import Link from 'project/zemn.me/components/Link';
import { Prose } from 'project/zemn.me/components/Prose/prose';
import { useState } from 'react';

// i let loose a little with the parser-combinators here
// i'm sorry. it's christmas!

const concat =
	<I1, I2, O1 extends string, O2 extends string>(
		ser1: (v: I1) => O1,
		ser2: (v: I2) => O2
	) =>
	(v: I1 & I2): `${O1}${O2}` =>
		`${ser1(v)}${ser2(v)}`;

const field =
	<FieldName extends string>(fn: FieldName) =>
	<I, O>(f: (v: I) => O) =>
	(v: Record<FieldName, I>): O =>
		f(v[fn]);

const optionalField =
	<FieldName extends string>(fn: FieldName) =>
	<I, O>(f: (v: I | undefined) => O) =>
	(v: Partial<Record<FieldName, I>>): O =>
		f(v[fn]);

const optional =
	<I, O>(fn: (v: I) => O) =>
	(v: I | undefined) =>
		v !== undefined ? fn(v) : '';

const param =
	<TagName extends string>(tagName: TagName) =>
	<I, O extends string>(fn: (i: I) => O) =>
	(i: I) =>
		`${tagName}:${fn(i)};` as const;

const string = (v: string) => v;

const percentEncodedString = (v: string) => encodeURIComponent(v);

// this is gonna be ugly because there's no pipeline operator yet
const toWifiUri = concat(
	() => 'wifi:' as const,
	(() => {
		//  i kinda want to automatically generate the form based on the data here.
		// it would be possible if i could define each of the used functions in abstract...
		const typeField = optionalField('type')(optional(param('T')(string)));
		const trDisableField = optionalField('trdisable')(
			optional(param('R')((bitfield: number) => bitfield.toString(16)))
		);
		const a = concat(typeField, trDisableField);

		const b = concat(a, field('ssid')(param('S')(percentEncodedString)));
		// honestly never thought i would ever need the 'true' type like this but I was wrong.
		const c = concat(
			b,
			optionalField('hidden')(
				// eslint-disable-next-line @typescript-eslint/no-unused-vars
				optional(param('H')((hidden: true) => 'true'))
			)
		);

		const d = concat(
			c,
			optionalField('id')(optional(param('I')(percentEncodedString)))
		);

		const e = concat(
			d,
			optionalField('password')(
				optional(param('P')(percentEncodedString))
			)
		);

		const f = concat(
			e,
			optionalField('public-key')(
				optional(
					// eslint-disable-next-line @typescript-eslint/no-unused-vars
					param('P')((_: never) => {
						throw new Error('not implemented');
					})
				)
			)
		);

		return f;
	})()
);

type WifiUriParts = Parameters<typeof toWifiUri>[0];

const wifi_ebnf = `WIFI-qr = “WIFI:” [type “;”] [trdisable “;”] ssid “;” [hidden “;”] [id “;”] [password “;”] [publickey “;”] “;”
type = “T:” *(unreserved) ; security type
trdisable = “R:” *(HEXDIG) ; Transition Disable value
ssid = “S:” *(printable / pct-encoded) ; SSID of the network
hidden = “H:true” ; when present, indicates a hidden (stealth) SSID is used
id = “I:” *(printable / pct-encoded) ; UTF-8 encoded password identifier, present if the password
has an SAE password identifier
password = “P:” *(printable / pct-encoded) ; password, present for password-based authentication
public-key = “K:” *PKCHAR ; DER of ASN.1 SubjectPublicKeyInfo in compressed form and encoded in
“base64” as per [6], present when the network supports SAE-PK, else absent
printable = %x20-3a / %x3c-7e ; semi-colon excluded
PKCHAR = ALPHA / DIGIT / %x2b / %x2f / %x3d`;

function WiFiUriGenerator() {
	const [ssid, setSsid] = useState<string>('my-network');
	const [hidden, setHidden] = useState<boolean>(false);
	const [id, setId] = useState<string | undefined>(undefined);
	const [password, setPassword] = useState<string | undefined>(undefined);
	return (
		<div>
			<Prose>
				<p>Defined by WPA3 Specification §7.1:</p>
				<code>
					<pre>{wifi_ebnf}</pre>
				</code>
			</Prose>

			<form>
				<fieldset>
					<legend>ssid</legend>
				</fieldset>
			</form>
		</div>
	);
}

export default function Main() {
	return (
		<Prose>
			<p>
				You may have noticed that in these modern days we can do such
				wonderful things as scan a QR code to join Wi-Fi.
			</p>
			<p>
				This is a little tool for playing around with that
				specification.
			</p>
			<p>
				The <code>wifi:</code> URI scheme is defined by IANA{' '}
				<Link href="https://www.iana.org/assignments/uri-schemes/prov/wifi">
					here
				</Link>
				, which just tells you to check section 7 of{' '}
				<Link href="https://www.wi-fi.org/file/wpa3-specification">
					this PDF
				</Link>
				.
			</p>
		</Prose>
	);
}
