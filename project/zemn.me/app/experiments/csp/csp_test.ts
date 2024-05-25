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
		data: [
			{
				name: "default-src",
				value: [
{
			scheme: "https",
			host: {
				wildcardPrefix: false,
				hostnameParts: ["google", "com"],
				trailingDot: false,
			},
			port: undefined,
			path: undefined
		}
				]
			}
		],
		success: true
	})
})

const complexExampleCsp = "default-src 'self'; script-src 'self' 'unsafe-inline' 'unsafe-eval' chatgpt.com/ces " +
	"https://*.chatgpt.com https://*.chatgpt.com/ https://*.oaistatic.com https://api.openai.com " +
	"https://chat.openai.com https://chatgpt.com/ https://chatgpt.com/backend-anon " +
	"https://chatgpt.com/backend-api https://chatgpt.com/graphql https://chatgpt.com/public-api " +
	"https://chatgpt.com/voice https://jidori.g1.internal.services.openai.org https://oaistatic.com "+
	"https://snc.apps.openai.com https://snc.chatgpt.com/backend/se https://tcr9i.chat.openai.com " +
	"https://tcr9i.chatgpt.com/ wss://*.chatgpt.com wss://*.chatgpt.com/; script-src-elem 'self' " +
	"'unsafe-inline' auth0.openai.com challenges.cloudflare.com chatgpt.com/ces https://*.chatgpt.com " +
	"https://*.chatgpt.com/ https://*.oaistatic.com https://api.openai.com https://apis.google.com " +
	"https://chat.openai.com https://chatgpt.com/ https://chatgpt.com/backend-anon " +
	"https://chatgpt.com/backend-api https://chatgpt.com/graphql https://chatgpt.com/public-api " +
	"https://chatgpt.com/voice https://docs.google.com https://jidori.g1.internal.services.openai.org " +
	"https://js.live.net/v7.2/OneDrive.js https://oaistatic.com https://snc.apps.openai.com " +
	"https://snc.chatgpt.com/backend/se https://tcr9i.chat.openai.com https://tcr9i.chatgpt.com/ " +
	"https://www-onepick-opensocial.googleusercontent.com wss://*.chatgpt.com wss://*.chatgpt.com/; " +
	"img-src * 'self' data: https: https://docs.google.com https://drive-thirdparty.googleusercontent.com " +
	"https://ssl.gstatic.com; style-src 'self' 'unsafe-inline' chatgpt.com/ces https://*.chatgpt.com " +
	"https://*.chatgpt.com/ https://*.oaistatic.com https://api.openai.com https://chat.openai.com " +
	"https://chatgpt.com/ https://chatgpt.com/backend-anon https://chatgpt.com/backend-api " +
	"https://chatgpt.com/graphql https://chatgpt.com/public-api https://chatgpt.com/voice " +
	"https://jidori.g1.internal.services.openai.org https://oaistatic.com https://snc.apps.openai.com " +
	"https://snc.chatgpt.com/backend/se https://tcr9i.chat.openai.com https://tcr9i.chatgpt.com/ " +
	"wss://*.chatgpt.com wss://*.chatgpt.com/; font-src 'self' data: https://*.oaistatic.com " +
	"https://fonts.gstatic.com; connect-src 'self' *.oaiusercontent.com api-iam.intercom.io " +
	"api - js.mixpanel.com browser-intake - datadoghq.com chatgpt.com / ces " +
	"fileserviceuploadsperm.blob.core.windows.net http://0.0.0.0:* http://localhost:*" +
	"https://*.chatgpt.com https://*.chatgpt.com/ https://*.oaistatic.com https://api.onedrive.com " +
	"https://api.openai.com https://chat.openai.com https://chatgpt.com/ https://chatgpt.com/backend-anon " +
	"https://chatgpt.com/backend-api https://chatgpt.com/graphql https://chatgpt.com/public-api " +
	"https://chatgpt.com/voice https://content.googleapis.com https://docs.google.com https://events.statsigapi.net " +
	"https://featuregates.org https://graph.microsoft.com https://jidori.g1.internal.services.openai.org " +
	"https://oaistatic.com https://snc.apps.openai.com https://snc.chatgpt.com/backend/se https://tcr9i.chat.openai.com " +
	"https://tcr9i.chatgpt.com/ o33249.ingest.sentry.io statsigapi.net wss://*.chatgpt.com wss://*.chatgpt.com/ " +
	"wss://*.intercom.io wss://*.webpubsub.azure.com; frame-src challenges.cloudflare.com https://*.sharepoint.com " +
	"https://content.googleapis.com https://docs.google.com https://onedrive.live.com https://tcr9i.chat.openai.com " +
	"https://tcr9i.chatgpt.com/ js.stripe.com; worker-src 'self' blob:; media-src blob: 'self' *.oaiusercontent.com " +
	"fileserviceuploadsperm.blob.core.windows.net https://cdn.openai.com; frame-ancestors " +
	"chrome - extension://iaiigpefkbhgjcmcmffmfkpmhemdhdnj; report-to chatgpt-csp; report-uri " +
	"https://browser-intake-datadoghq.com/api/v2/logs?dd-api-key=pub1f79f8ac903a5872ae5f53026d20a77c&dd-evp-origin=content-security-policy&ddtags=group%3Achatgpt-csp"

it('should parse a complex CSP', () => {
	expect(SerializedPolicy.safeParse(complexExampleCsp)).toEqual({
		data: [
			{
				name: "default-src",
				value: [
{
			scheme: "https",
			host: {
				wildcardPrefix: false,
				hostnameParts: ["google", "com"],
				trailingDot: false,
			},
			port: undefined,
			path: undefined
		}
				]
			}
		],
		success: true
	})
})
