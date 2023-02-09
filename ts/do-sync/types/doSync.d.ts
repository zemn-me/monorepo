/**
 * @fileoverview
 * Typescript's compile-time linker places do-sync in node_modules -- but the
 * information is not accessible until compile-time.
 *
 * Import this declaration file to let the editor typechecker know that its interface
 * is the same as the unbuilt one.
 *
 * It does *not* need to be imported (and doing so will confuse the build).
 */

declare module 'do-sync' {
	export { default } from 'ts/do-sync';
	export * from 'ts/do-sync';
}
