"use client"

import { union } from "zod/mini"

import { OIDCAuthErrorResponse, OIDCImplicitAuthResponse } from "#root/ts/oidc/callback_params.js"
import { createZodCodecParser } from "#root/ts/zod/nuqs.js";

/**
 * @fileoverview
 * OAuth callback page
 */




const params = union([OIDCImplicitAuthResponse, OIDCAuthErrorResponse]);

function deepEqual(a, b) {
  return JSON.stringify(structuredClone(a)) === JSON.stringify(structuredClone(b));
}

const paramsParser = createZodCodecParser(
	params,
	deepEqual
);

export default function Client() {

}
