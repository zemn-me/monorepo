"use client";
import { useEffect } from "react";


function useTrustedTypesPolicy() {
	useEffect(() => {
		if (!window.trustedTypes) return;
		if (window.trustedTypes.defaultPolicy) return;

		window.trustedTypes.createPolicy("default", {
			createHTML: v => v,
		});

		return;
	})
}

export function TrustedTypesPolicy() {
	useTrustedTypesPolicy();
	return null;
}
