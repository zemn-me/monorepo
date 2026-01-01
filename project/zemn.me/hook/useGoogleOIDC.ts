import { useOIDC } from "#root/project/zemn.me/hook/useOIDC.js";


export function useGoogleOIDC(scopes: string[]) {
	return useOIDC(
		"https://accounts.google.com",
		"845702659200-q34u98lp91f1tqrqtadgsg78thp207sd.apps.googleusercontent.com",
	)
}
