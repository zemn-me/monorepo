/**
 * @fileinfo process env stuff for SSR
 */

import { must } from './guard';

export const window = process.browser ? globalThis.window: undefined;

export const origin = must(
    window?.location.origin ?? process.env.origin,
    "origin"
)

export const protocol = must(
    window?.location.protocol ?? process.env.protocol,
    "protocol"
)