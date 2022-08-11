import bcrypt from 'bcryptjs';

/**
 * Allowlist takes a set of bcrypt digests, and returns a function which, when passed an input returns that
 * same input provided it matches one of the bcrypt digests. Otherwise, it returns `false`.
 *
 * This can be used to store some secret in the client without making it implicitly available to anyone who views the source.
 *
 * @example
 * // if our website is https://cool.com, this alerts 'hello world' if loaded as https://cool.com#hello%20world
 * const getMessage = allowlist('$2y$12$hxyWxMx.qap70Snn1QKMwuDp/9XgNM7HpwbrGnsPu/j7dyTEWh0M2');
 * alert(getMessage(decodeURIComponent(window.hash.slice(1))))
 */
export const allowlist =
	(...bcrypt_digests: string[]) =>
	<S extends string>(input: S): S | false =>
		bcrypt_digests.some(digest => bcrypt.compareSync(input, digest)) &&
		input;

export default allowlist;
