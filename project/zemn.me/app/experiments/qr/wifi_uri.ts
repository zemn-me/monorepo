const string = (v: string) => v;
const percentEncodedString = (v: string) => encodeURIComponent(v);

type Transform = (v: any) => string;

export const WiFiUri =
	<Field, Param>(
		optional: (
			name: string
		) => (param: Param) => (transform: Transform) => Field
	) =>
	(
		mandatory: (
			name: string
		) => (param: Param) => (transform: Transform) => Field
	) =>
	(param: (name: string) => Param) =>
	<R>(fields: (fields: Field[]) => R) =>
		fields([
			optional('type')(param('T'))(string),
			optional('trdisable')(param('R'))(string),
			mandatory('ssid')(param('S'))(percentEncodedString),
			optional('hidden')(param('H'))((_: true) => 'true'),
			optional('id')(param('I'))(percentEncodedString),
			optional('password')(param('P'))(percentEncodedString),
			optional('public-key')(param('PK'))(percentEncodedString),
		]);
