import { z } from "zod";


export const e164 =
	z.string().regex(
		/^\+\d+$/,
		"Must be valid (E.164) international formatted phone-number."
	)
