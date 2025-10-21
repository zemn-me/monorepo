import z from "zod";


export const Quality = z.enum([
	"normal",
	"uncommon",
	"rare",
	"epic",
	"legendary"
])
