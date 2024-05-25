import { SerializedHostSource, SerializedPolicy } from "#root/project/zemn.me/app/experiments/csp/parse.js"

it('should parse google.com properly', () => {
	expect(SerializedHostSource.safeParse("google.com")).toEqual({
		data: {
			scheme: undefined,
			host: {
				wildcardPrefix: false,
				hostnameParts: ["google", "com"],
				trailingDot: false,
			},
			port: undefined,
			path: undefined
		},
		success: true
	})
});

it('should parse https://example.com properly', () => {
	expect(SerializedHostSource.safeParse("https://example.com")).toEqual({
		data: {
			scheme: "https",
			host: {
				wildcardPrefix: false,
				hostnameParts: ["example", "com"],
				trailingDot: false,
			},
			port: undefined,
			path: undefined
		},
		success: true
	})
});


it('should parse a simple source list correctly', () => {
	expect(SerializedPolicy.safeParse("default-src https://google.com")).toEqual({
		data: {

		},
		success: true
	})
})
