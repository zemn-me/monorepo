import { useEffect, useState } from "react";

export const ANALYTICS_SESSION_ID_QUERY_KEY = ["analytics_session_id"] as const;
export const ANALYTICS_SESSION_ID_STORAGE_KEY = "zemn_analytics_session_id";

export function useAnalyticsSessionId() {
	const [sessionID, setSessionID] = useState<string>();

	useEffect(() => {
		if (typeof window === "undefined") {
			return;
		}

		let persisted = window.localStorage.getItem(ANALYTICS_SESSION_ID_STORAGE_KEY);
		if (persisted === null || persisted === "") {
			persisted = crypto.randomUUID();
			window.localStorage.setItem(ANALYTICS_SESSION_ID_STORAGE_KEY, persisted);
		}

		setSessionID(persisted);
	}, []);

	return sessionID;
}
