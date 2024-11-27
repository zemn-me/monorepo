"use client";
import { useEffect } from "react";


function useTrustedTypesPolicy() {
	useEffect(() => {
		if (!window.trustedTypes) return;

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
