import { useQuery } from "@tanstack/react-query";

export const DEVICE_ID_QUERY_KEY = ["device_id"] as const;
export const DEVICE_ID_STORAGE_KEY = "zemn_device_id";

function readOrCreateDeviceId() {
	let persisted = window.localStorage.getItem(DEVICE_ID_STORAGE_KEY);
	if (persisted === null || persisted === "") {
		persisted = crypto.randomUUID();
		window.localStorage.setItem(DEVICE_ID_STORAGE_KEY, persisted);
	}

	return persisted;
}

export function useDeviceId() {
	const deviceID = useQuery({
		queryKey: DEVICE_ID_QUERY_KEY,
		queryFn: () => readOrCreateDeviceId(),
		enabled: typeof window !== "undefined",
		staleTime: Number.POSITIVE_INFINITY,
		gcTime: Number.POSITIVE_INFINITY,
	});

	return deviceID.data;
}
