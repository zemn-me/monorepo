# knowitwhenyouseeit

> provides functions to render client-side data but only if it matches a secure digest

[![NPM](https://img.shields.io/npm/v/knowitwhenyouseeit.svg)](https://www.npmjs.com/package/knowitwhenyouseeit)

## Install

```bash
yarn add knowitwhenyouseeit
```

## Usage

```jsx
import allowlisted from 'knowitwhenyouseeit';

const getMessage = allowllisted(
	'$2y$12$BcuZ0VfUeLLpoLxOC5Xv7eQQK0r95by8YJsECCldKP4ftPr20rpXW', //hello world
	'$2y$12$hxyWxMx.qap70Snn1QKMwuDp/9XgNM7HpwbrGnsPu/j7dyTEWh0M2' //hewwo world
);

getMessage('helllo world!'); // false
getMessage('hello world'); // "hello world"
```

## License

MIT © [zemnmez](https://github.com/zemnmez)
