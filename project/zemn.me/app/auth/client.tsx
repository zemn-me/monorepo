"use client"

import { useRouter } from "next/router";
import { union } from "zod/mini"

import { OIDCAuthErrorResponse, OIDCImplicitAuthResponse } from "#root/ts/oidc/callback_params.js"
import { and_then, and_then_flatten, Err, Ok } from "#root/ts/result/result.js";

/**
 * @fileoverview
 * OAuth callback page
 */

const params = union([OIDCImplicitAuthResponse, OIDCAuthErrorResponse]);

export default function Client() {
	const zq = params.safeParse(useRouter().query);
	const query = zq.success ? Ok(zq.data) : Err(zq.error);

	const success_params = and_then_flatten(query,
		params =>
			'error' in params?
				Err(new Error(params.error))
				: Ok(params)
	)

	// state validation needed




}
