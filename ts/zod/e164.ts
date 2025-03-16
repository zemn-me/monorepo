import { z } from "zod";


export const e164 =
	z.string().regex(
		/^\+?[1-9]\d{1,14}/,
		"Must be valid (E.164) international formatted phone-number."
	)
