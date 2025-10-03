"use client"

import { useRouter } from "next/router";
import { union } from "zod/mini"

import { useZemnMeApi } from "#root/project/zemn.me/hook/useZemnMeApi.js";
import { OIDCAuthErrorResponse, OIDCImplicitAuthResponse } from "#root/ts/oidc/callback_params.js"
import { and_then, and_then_flatten, Err, Ok, unwrap_or, unwrap_or_else } from "#root/ts/result/result.js";
import { useEffect } from "react";

export default function Client() {
	useEffect(() => {
		if (!(window.opener instanceof Window)) {
			window.close();
		} else {
			window.opener.postMessage(location.search, location.origin);
		}
	})
}

