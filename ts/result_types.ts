import * as result from '#root/ts/result/result.js';

/**
 * @deprecated — please use {@link result.Ok} instead.
 */
export type Ok<T> = result.Ok<T>;

/**
 * @deprecated — please use {@link result.Err} instead.
 */
export type Err<T> = result.Err<T>;

/**
 * @deprecated — please use {@link result.Result} instead.
 */
export type Result<T, E> = result.Result<T, E>;

/**
 * @deprecated — please use {@link result.Ok} instead.
 */
export const Ok = result.Ok;

/**
 * @deprecated — please use {@link result.Err} instead.
 */
export const Err = result.Err;

/**
 * @deprecated — please use {@link result.is_ok} instead.
 */
export const is_ok = result.is_ok;

/**
 * @deprecated — please use {@link result.is_err} instead.
 */
export const is_err = result.is_err;

/**
 * @deprecated — please use {@link result.unwrap_err} instead.
 */
export const unwrap_err = result.unwrap_err;

/**
 * @deprecated — please use {@link result.unwrap_err_unchecked} instead.
 */
export const unwrap_err_unchecked = result.unwrap_err_unchecked;

/**
 * @deprecated — please use {@link result.unwrap} instead.
 */
export const unwrap = result.unwrap;

/**
 * @deprecated — please use {@link result.unwrap_unsafe} instead.
 */
export const unwrap_unsafe = result.unwrap_unsafe;

/**
 * @deprecated — please use {@link result.unwrap_unchecked} instead.
 */
export const unwrap_unchecked = result.unwrap_unchecked;

/**
 * @deprecated — please use {@link result.unwrap_or} instead.
 */
export const unwrap_or = result.unwrap_or;

/**
 * @deprecated — please use {@link result.unwrap_or_else} instead.
 */
export const unwrap_or_else = result.unwrap_or_else;

/**
 * @deprecated — please use {@link result.and_then} instead.
 */
export const and_then = result.and_then;

/**
 * @deprecated — please use {@link result.flatten} instead.
 */
export const flatten = result.flatten;

/**
 * @deprecated — please use {@link result.zip} instead.
 */
export const zip = result.zip;

/**
 * @deprecated — please use {@link result.result_promise_transpose} instead.
 */
export const result_promise_transpose = result.result_promise_transpose;

/**
 * @deprecated — please use {@link result.result_collect} instead.
 */
export const result_collect = result.result_collect;
