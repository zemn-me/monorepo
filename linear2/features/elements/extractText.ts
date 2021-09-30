// attempts to statically extract text from a react tree.
// use with care.

type Children =
	| string
	| React.ReactElement<ExtractableProps>[]
	| React.ReactElement<ExtractableProps>
	| null;

export type ExtractableProps = {
	children?: Children;
};

export const extractText: (r: Children) => string = r => {
	if (typeof r == 'string') return r;
	if (r == null) return '';
	if (r instanceof Array) return r.map(extractText).join('');
	if (r.props.children == undefined) return '';
	return extractText(r.props.children);
};
