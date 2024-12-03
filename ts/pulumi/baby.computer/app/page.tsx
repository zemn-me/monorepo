import '#root/ts/pulumi/baby.computer/app/base.css';

interface CssNumber {
	type: "css-number"
	value: number
	unit?: string
}

type CssExpr = CssNumber | CSSFunctionCall

interface CSSFunctionCall {
	type: "css-fn-call"
	fn: string
	args: CssExpr[]
}

function css(expr: CssExpr): string {
	switch (expr.type) {
		case "css-fn-call":
			return `${
				expr.fn
			}(${
				expr.args.map(a => css(a)).join(",")
			})`
		case "css-number":
			return `${expr.value}${expr.unit?? ""}`
	}
}

function number(n: number) {
	return { type: "css-number", value: n} satisfies CssNumber
}

function percent(n: number) {
	return {...number(n), unit: '%'} satisfies CssNumber
}

function viewportWidth(n: number) {
	return {...number(n), unit: 'vw'} satisfies CssNumber
}

function viewportHeight(n: number) {
	return {...number(n), unit: 'vh'} satisfies CssNumber
}

function clamp(min: CssExpr, val: CssExpr, max: CssExpr) {
	return {
		type: "css-fn-call",
		fn: "clamp",
		args: [min, val, max]
	} satisfies CSSFunctionCall
}

function min(...val: CssExpr[]) {
	return {
		type: "css-fn-call",
		fn: "min",
		args: val
	} satisfies CSSFunctionCall
}

function max(...val: CssExpr[]) {
	return {
		type: "css-fn-call",
		fn: "max",
		args: val
	} satisfies CSSFunctionCall
}


const perc = 90;

export default function Page() {
	return <div style={{
		fontSize: css(clamp(
			min(
				viewportWidth(perc),
				viewportHeight(perc)
			),
			percent(100),
			max(viewportHeight(perc), viewportWidth(perc))
		)),
		display: 'grid',
		margin: 'auto',
		padding: 'auto',
		textAlign: 'center'
	}}>
		🐧
	</div>;
}
