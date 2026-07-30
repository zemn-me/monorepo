import allowlist from '#root/ts/knowitwhenyouseeit/index.js';

export const getMessage = allowlist(
	'$2y$12$BcuZ0VfUeLLpoLxOC5Xv7eQQK0r95by8YJsECCldKP4ftPr20rpXW', // hello world
	'$2y$12$hxyWxMx.qap70Snn1QKMwuDp/9XgNM7HpwbrGnsPu/j7dyTEWh0M2' // hewwo world
);

getMessage('helllo world!'); // false
getMessage('hello world'); // "hello world"
