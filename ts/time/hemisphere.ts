import data from 'tzdata';



export const tz = (
	fmt: Intl.DateTimeFormat =
		Intl.DateTimeFormat()
) => fmt.resolvedOptions().timeZone;

const isKnownTz = (v: string | number | symbol): v is (keyof typeof data.zones) => v in data.zones;

export const tzLoc = (
	tzName: string = tz()
) => {
	if (!isKnownTz(tzName)) return undefined;

	return data.zones[tzName].
}

