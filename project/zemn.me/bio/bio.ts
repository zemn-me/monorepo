import * as lang from '#root/ts/react/lang.js';
import * as time from '#root/ts/time.js';

type Text = lang.Text;

const en = lang.tag('en-GB');
const nl = lang.tag('nl');

const date = (...params: time.date.Date) => time.date.parse(params);

const url = (s: TemplateStringsArray, ...f: { toString(): string }[]): URL => {
	const o: string[] = [];
	for (let i = 0; i < Math.max(s.length, f.length); i++)
		o.push(s[i] ?? '', (f[i] ?? '').toString());

	let sURL = o.join('');
	if (/^\/\//.test(sURL)) sURL = 'https:' + sURL;

	return new URL(sURL);
};

export type Endpoint = Date | 'ongoing';

export interface Bio {
	readonly birthdate: Date;
	readonly skills: readonly Text[];
	readonly links: readonly (readonly [Text, URL])[];
	readonly timeline: readonly Event[];
	readonly who: Who;
}

export type Timeline = readonly Event[];

export interface Who {
	readonly handle: Text;
	readonly fullName: Text;
	readonly name: Text;
	readonly firstName: Text;
	readonly lastName: Text;
}

export type Tag = Text;

export interface Employment {
	readonly since: Date;
	readonly title: Text;
	readonly where: Text;
}

export interface Event {
	id: string;
	readonly date: Date;
	readonly description?: Text;
	readonly tags?: readonly Tag[];
	readonly title: Text;
	readonly url?: URL;
	readonly priority?: number;
	readonly until?: Endpoint;
}

// tags
export const gaming = en`gaming`,
	accolade = en`accolade`,
	talk = en`talk`,
	software = en`software`,
	react = en`react`,
	security = en`security`,
	d3 = en`d3`,
	library = en`library`,
	disclosure = en`disclosure`,
	comment = en`comment`,
	work = en`work`,
	writing = en`writing`,
	science = en`science`,
	design = en`design`,
	code = en`code`,
	typescript = en`typescript`,
	nodejs = en`nodejs`,
	golang = en`golang`,
	rust = en`rust`,
	go = en`go`;

export const Bio = {
	birthdate: date(17, 'may', 1994),
	links: [
		[
			lang.Text('en-GB', 'linkedin' as const),
			url`//www.linkedin.com/in/thomas-shadwell-4b333b50`,
		],
		[lang.Text('en-GB', 'github' as const), url`//github.com/zemnmez`],
		// probably should have an enable/ disable here at some point
		// [en`twitch`, url`//twitch.tv/zemnmez`],
		[lang.Text('en-GB', 'twitter' as const), url`//twitter.com/zemnmez`],
	],
	skills: [
		en`Go`,
		en`Typescript`,
		en`Python`,
		en`GraphQL`,
		en`Static Analysis`,
		en`Javascript`,
		en`React`,
		en`d3`,
		en`Bash`,
		en`Ruby`,
		en`appsec arch`,
		en`Electron`,
		en`AWS`,
		en`pentesting`,
		en`code review`,
		en`cryptography`,
		en`reversing`,
		en`starlark`,
		en`bazel`,
	],
	timeline: [
		// BEGIN TOOL ASSISTED SORT
		{
			id: 'bda2ee54-67ba-4650-887c-78240143a825',
			date: date(23, 'nov', 2022),
			description: en`Google research; exploit to remotely take over VSCode and any attached cloud systems. CVE-2022-41034, GHSA-pw56-c55x-cm9m`,
			tags: [security, disclosure],
			title: en`Visual Studio Code: Remote Code Execution`,
			url: url`https://github.com/google/security-research/security/advisories/GHSA-pw56-c55x-cm9m`,
		},

		{
			id: '93de4b1d-0501-4839-b735-66ff8db48aca',
			date: date(14, 'jan', 2019),
			description: en`react helper bindings for d3`,
			priority: 6,
			tags: [software, library, d3, react],
			title: en`reactive-d3`,
			url: url`https://github.com/Zemnmez/reactive-d3`,
		},
		{
			id: '73ee7f25-a947-4d86-8efe-0ba52c105b94',
			date: date(18, 'feb', 2017),
			description: en`musings on the evolution of design`,
			tags: [writing],
			title: en`Design Evolves By Constraint`,
			url: url`https://medium.com/@Zemnmez/design-evolves-by-constraint-f2d87697d25e`,
		},
		{
			id: 'b0e4bf15-c630-4804-b1db-713cd79d4633',
			date: date(3, 'jan', 2016),
			description: en`minimal reactive d3.js resistor colour code calculator`,
			priority: 6,
			tags: [software],
			title: en`r.no.ms`,
			url: url`http://r.no.ms`,
		},
		{
			id: 'a3363960-8fa3-4c5d-b434-c99d4c8b5519',
			date: date(1, 'apr', 2011),
			description: en`London Real Time Hackathon`,
			priority: 5,
			tags: [software, accolade],
			title: en`Geckoboard Prize`,
			url: url`https://web.archive.org/web/20121113024249/http:%2F%2Flondonrealtime.co.uk/`,
		},
		{
			id: 'faf30607-fb52-44b7-a331-13d2abf3ffa7',
			date: date(25, 'feb', 2020),
			title: en`SVGShot`,
			url: url`https://github.com/Zemnmez/svgshot`,
			description: en`small tool for taking SVG 'screenshots' of webpages`,
			tags: [typescript, code],
		},
		{
			id: '299714d5-7580-4889-94b2-0c71b2e1ca9c',
			date: date(1, 'sep', 2011),
			description: en`Volunteer role at once largest trading website in the Steam community. Worked on administration of high-profile trades & scams`,
			until: date(1, 'sep', 2014),
			priority: 5,
			tags: [work, gaming],
			title: en`Sr. Admin, TF2Outpost`,
		},
		{
			id: '10750828-785a-491e-bd00-dad3c886fd01',
			date: date(5, 'aug', 2011),
			description: en`Rewired State: Parliament`,
			priority: 5,
			tags: [software, accolade],
			title: en`Better understanding of the work of Parliament Prize`,
			url: url`https://web.archive.org/web/20121105174535/http:%2F%2Frewiredstate.org:80/blog/2011/11/press-release-for-rewired-state-parliament`,
		},
		{
			id: '963e6a0a-d279-4838-a2d6-2445a0ec97e4',
			date: date(1, 'feb', 2011),
			description: en`Young Rewired State 2011`,
			priority: 5,
			tags: [software, accolade],
			title: en`Best example of Coding`,
			url: url`https://web.archive.org/web/20120306190316/http:%2F%2Fyoungrewiredstate.org/2011-08/cant-vote-but-can-put-a-wind-in-governments-sails/`,
		},
		{
			id: 'e4ad85a6-fee3-4824-aadc-3963ef30dcb9',
			date: date(1, 'feb', 2020),
			title: en`HackFortress Shmoocon 2020 Champions`,
			tags: [accolade, security, gaming],
			description: en`defended title for hybrid gaming ctf`,
		},
		{
			id: 'befbb9a3-5499-4f45-b251-fa899c178b4d',
			date: date(2, 'aug', 2019),
			title: en`If CORS is just a header, why don’t attackers just ignore it?`,
			url: url`https://medium.com/@Zemnmez/if-cors-is-just-a-header-why-dont-attackers-just-ignore-it-63e57c323cef?source=your_stories_page---------------------------`,
			description: en`article on common security misconceptions around CORS`,
			tags: [writing, security],
		},
		{
			id: '9195a7e3-b02f-4eb5-8b47-6ae7a9900800',
			date: date(9, 'aug', 2020),
			title: en`HackFortress DefCon 2020 Champions`,
			tags: [accolade, security],
		},
		{
			id: '169b8cda-5634-49fd-9f96-cce5566bb545',
			date: date(1, 'may', 2012),
			description: en`full stack freelance work building MVPs for London startups and wrangling data for hackathons`,
			until: date(1, 'may', 2014),
			priority: 7,
			tags: [work],
			title: en`Software Engineer, Consultant`,
		},
		{
			id: 'ace0faea-313d-49f0-bbb0-9ab908fb956a',
			date: date(7, 'jan', 2019),
			description: en`react based personal website for 2019`,
			priority: 6,
			tags: [software, react],
			title: en`linear`,
			url: url`https://github.com/Zemnmez/linear`,
		},
		{
			id: '763a0f63-bf83-4fef-9693-6cf89804f583',
			date: date(19, 'oct', 2020),
			title: en`Typescript Union Merging`,
			description: en`Using interface merging to write somewhat decentralised Redux actions`,
			url: url`https://medium.com/@Zemnmez/typescript-union-merging-b2ea332f08f1`,
			tags: [code, typescript, writing],
		},
		{
			id: '150422cc-71bc-444e-bfdb-f16453f4d70a',
			title: en`CSVPretty`,
			url: url`https://github.com/Zemnmez/csvpretty`,
			description: en`typescript pretty printer for the CSV format`,
			date: date(23, 'jul', 2019),
			tags: [golang, code],
		},
		{
			id: '214f6425-d041-4d81-824e-737d6b3cd2df',
			date: date(8, 'nov', 2011),
			description: en`Interview on National Hack the Government Day prize (dutch)`,
			priority: 5,
			tags: [software, comment],
			title: nl`MozFest: Rewired State geeft jonge programmeurs een kans`,
			url: url`http://www.denieuwereporter.nl/2011/11/mozfest-rewired-state-geeft-jonge-programmeurs-een-kans/`,
		},
		{
			id: '6b7e92fb-bb5d-40ec-8210-2e4a28e54e66',
			date: date(1, 'apr', 2011),
			description: en`National Hack the Government Day 2011`,
			priority: 5,
			tags: [software, accolade],
			title: en`Wallace and Gromit Prize`,
			url: url`https://www.theguardian.com/info/developer-blog/2011/apr/05/national-hack-the-government-day-2011`,
		},
		{
			id: '08e89c21-4532-4a6d-af34-39909e30fe82',
			date: date(11, 'apr', 2020),
			title: en`do-sync`,
			description: en`Async to sync library for encapsulated javascript macros`,
			url: url`https://github.com/Zemnmez/do-sync`,
			tags: [code, typescript],
		},
		{
			id: '7196a47d-d9f9-442f-84dd-31e2fcf76e77',
			date: date(16, 'jun', 2019),
			title: en`react-oauth2-hook`,
			url: url`https://github.com/Zemnmez/react-oauth2-hook`,
			description: en`An entirely clientside implementation of an oauth2 implicit client, with React hooks`,
			tags: [react, code, security, typescript],
		},
		{
			id: '0943b965-3c14-4bb9-b1c4-57a3a5135d89',
			date: date(1, 'may', 2020),
			title: en`Why We don't we have UIs like the ones in Neon Genesis`,
			description: en`Exploration of how rendering hardware has affected UI design`,
			url: url`https://medium.com/@Zemnmez/why-we-dont-have-uis-like-the-ones-in-neon-genesis-9b6631dc3714`,
			tags: [writing, design],
		},
		{
			id: 'd3c0644d-82a4-49cb-ae5e-a75d36779232',
			date: date(4, 'jul', 2017),
			description: en`musings on go-specific security gotchas`,
			priority: 5,
			tags: [security, talk],
			title: en`This Will Cut You: Go's Sharper Edges`,
			url: url`https://www.infoq.com/presentations/go-security`,
		},
		{
			id: 'f775df0d-070c-4a96-accc-5f6b4fd60e71',
			date: date(1, 'mar', 2012),
			description: en`charity focused on teaching code literacy. Ran and participated in hackathons for good causes. Taught software engineering to young people`,
			until: date(1, 'mar', 2015),
			priority: 6,
			tags: [software, security, work],
			title: en`Developer, Rewired State`,
		},
		{
			id: '886812e0-cc54-40a8-88ef-a23c1ae35390',
			date: date(23, 'nov', 2017),
			description: en`talk at owasp about critical uk tax system flaw in obfuscated system and the 57 day trek to get it fixed`,
			priority: 6,
			tags: [security, talk],
			title: en`how to hack the uk tax system: the talk`,
			url: url`https://twitter.com/zemnmez/status/933847040198574080`,
		},
		{
			id: '12939520-a1eb-420d-bd2f-3fbe0922d66d',
			date: date(25, 'jan', 2016),
			description: en`unauthorized remote shutdown of Buffalo-made network attached storage devices`,
			priority: 6,
			tags: [security, writing, disclosure],
			title: en`Buffalo NAS Remote Shutdown`,
			url: url`https://packetstormsecurity.com/files/135368`,
		},
		{
			id: '9fd25be4-62d1-4b48-ab9f-4c3357357674',
			date: date(22, 'apr', 2014),
			description: en`unique developer granted cosmetic item for the video game Team Fortress 2 granted for security issues allowing movement millions of dollars of virtual items between arbitrary accounts via account takeover`,
			priority: 6.5,
			tags: [gaming, security, accolade],
			title: en`Sunbeams Ebenezer`,
			url: url`http://steamcommunity.com/id/both/inventory/#440_2_4818206214`,
		},
		{
			id: '4a091ea1-6e55-424e-9bdf-59fbd7fcb9d6',
			date: date(14, 'dec', 2015),
			description: en`unique developer granted cosmetic item for the video game Team Fortress 2 granted for security issue allowing decryption of all Steam traffic`,
			priority: 6.5,
			tags: [gaming, security, accolade],
			title: en`Burning Flames Finder\u2019s Fee`,
			url: url`https://steamcommunity.com/id/both/inventory/#440_2_4398163918`,
		},
		{
			id: '1bb3ddd1-bdab-4eca-97e2-5e2b50323136',
			date: date(20, 'jan', 2019),
			description: en`hybrid ctf / esports competition winners`,
			priority: 6,
			tags: [accolade, security, gaming],
			title: en`hack fortress 2019 champions`,
			url: url`https://twitter.com/tf2shmoo/status/1086785642514796544`,
		},
		{
			id: 'a0113940-008d-45e0-a279-ad3d417c7171',
			date: date(15, 'dec', 2018),
			description: en`Quick article on the security of modern desktop web applications`,
			priority: 7,
			tags: [security, disclosure],
			title: en`\u00dcbersicht Remote Code Execution, Spotify takeover`,
			url: url`https://medium.com/@Zemnmez/%C3%BCbersicht-remote-code-execution-spotify-takeover-a5f6fd6809d0`,
		},
		{
			id: 'a0b8e856-400c-4b85-9407-4bbaa8e57783',
			date: date(12, 'aug', 2019),
			priority: 6,
			tags: [security, gaming, accolade],
			title: en`hack fortress DEFCON 2018 winners`,
			url: url`https://twitter.com/tf2shmoo/status/1028462663368507392`,
		},
		{
			id: '214fcf06-69b5-4eb2-a5d3-882e13c42071',
			date: date(19, 'oct', 2015),
			description: en`unique developer granted cosmetic item for the video game Team Fortress 2 granted for security issues allowing remote access to computers running the video game`,
			priority: 7,
			tags: [gaming, security, accolade],
			title: en`Nebula Finder\u2019s Fee`,
			url: url`https://steamcommunity.com/id/both/inventory/#440_2_4228772424`,
		},
		{
			id: '3ab05545-8d7b-47d7-9dca-6f5582a806d8',
			date: date(11, 'may', 2016),
			description: en`XSS in Mr Robot official site`,
			priority: 6,
			tags: [security, disclosure, comment],
			title: en`Irony Alert: Hacker Finds Vulnerability In Mr Robot Website`,
			url: url`https://www.forbes.com/sites/thomasbrewster/2016/05/11/flaw-in-mr-robot-website-allowed-facebook-attack/#747437ef6bed`,
		},
		{
			id: '08426500-28e9-4398-8156-102df7dda51e',
			date: date(24, 'jan', 2016),
			description: en`Host based account hijack attack on php-openid`,
			priority: 6,
			tags: [security, writing, disclosure],
			title: en`CVE-2016-2049`,
			url: url`https://nvd.nist.gov/vuln/detail/CVE-2016-2049`,
		},
		{
			id: 'aab4593b-9c81-444e-b607-e6f02b812f14',
			date: date(16, 'may', 2016),
			description: en`code execution in official Mr Robot site`,
			priority: 7,
			tags: [security, disclosure, comment],
			title: en`'Mr. Robot' Web Weaknesses Left Fans And USA Network Vulnerable, Warns Non-Fictional Hacker`,
			url: url`https://www.forbes.com/sites/thomasbrewster/2016/05/16/mr-robot-imagetragick-usa-network-wide-open-to-hackers/#7d49f6f66d77`,
		},
		{
			id: '24896136-580f-460b-a1d3-56f5ba92ae17',
			date: date(1, 'jan', 2013),
			description: en`international chemistry challenge`,
			priority: 6,
			tags: [science, accolade],
			title: en`7th place Cambridge Chemistry Challenge (C3L6)`,
		},
		{
			id: '74086941-7c37-4f3e-af9b-4cc8e8bbc749',
			date: date(1, 'jan', 2014),
			description: en`international chemistry challenge`,
			priority: 5,
			tags: [science, accolade],
			title: en`5th place, Cambridge Chemistry Challenge (C3L6)`,
		},
		{
			id: '7aa346f4-31b3-41fa-9844-58a4be83b050',
			date: date(2, 'sep', 2018),
			title: en`I hacked video games like 300 times and all I got was this stupid talk`,
			tags: [talk, gaming, security],
			description: en`talk at game dev days 2018 in Graz, Austria summarising some security concepts for game developers`,
			url: url`https://www.youtube.com/watch?v=NjMMK-FkTW4&list=PLFqM5L7fs0mO3O3-BBZfA-sHeT86Gesd8&index=15&`,
		},
		{
			id: '91956c2c-ebb6-45a1-aca0-065c3cc4b003',
			date: date(5, 'sep', 2018),
			title: en`Cross-site information assertion leak via Content Security Policy`,
			url: url`https://hackerone.com/reports/16910`,
			description: en`CSP1 information leak allowing efficient deanonymisation of internet users`,
			tags: [security, disclosure],
		},
		{
			id: 'f6bfd6fd-a84f-449d-90f9-218a55f22c35',
			date: date(7, 'jul', 2014),
			description: en`exploit using content security policy 1 to steal data on the web`,
			priority: 9,
			tags: [security, writing, disclosure],
			title: en`when security creates insecurity`,
			url: url`http://archive.is/UXD8j`,
		},
		{
			id: 'd4b51ac9-107c-4e83-b07f-0cffa34255f6',
			date: date(27, 'apr', 2016),
			description: en`padding oracle based decryption of Steam traffic`,
			priority: 7,
			tags: [security, gaming, disclosure],
			title: en`steam patches broken crypto in wake of replay, padding oracle attacks`,
			url: url`https://threatpost.com/steam-patches-broken-crypto-in-wake-of-replay-padding-oracle-attacks/117691/`,
		},
		{
			id: 'fdee36cb-45fa-4d94-8575-e3e19ac2ed09',
			date: date(7, 'jan', 2019),
			description: en`vulnerability to remotely access Steam users' computers`,
			priority: 8,
			tags: [gaming, security, accolade],
			title: en`Steam Remote Code Execution`,
			url: url`https://hackerone.com/reports/409850`,
		},
		{
			id: '440b0daa-bb07-44e0-81a6-7a51eda0d9b5',
			date: date(7, 'jan', 2019),
			description: en`XSS to RCE on Steam`,
			tags: [security, writing, disclosure],
			title: en`XSS in Steam React Chat Client`,
			url: url`//hackerone.com/reports/409850`,
		},
		{
			id: '98835628-87ee-435f-bfbf-4d44540b0b94',
			date: date(8, 'jan', 2019),
			description: en`news coverage of steam rce`,
			priority: 7,
			tags: [security, disclosure, comment],
			title: en`$7,500 Steam Weakness Let Hackers Take Remote Control Of Gamers' PCs`,
			url: url`https://www.forbes.com/sites/thomasbrewster/2019/01/08/7500-steam-weakness-let-hackers-take-remote-control-of-gamers-pcs`,
		},
		{
			id: '1028217a-3167-44ce-af82-7e0b23847471',
			date: date(17, 'may', 2019),
			title: en`Full Steam Ahead: Remotely Executing Code in Modern Desktop Applications`,
			description: en`technical talk at offensive AppSec conference Infiltrate summarising through example research into hybrid web / desktop application security`,
			tags: [en`talk`, security, gaming],
			url: url`https://vimeo.com/335206831`,
		},
		{
			id: '9160d646-f61a-4dd2-9533-84d176e65300',
			date: date(8, 'sep', 2017),
			description: en`news post on manipulation of UK tax data`,
			priority: 6,
			tags: [security, disclosure, comment],
			title: en`'Serious' security flaws found on official UK tax site`,
			url: url`http://www.bbc.co.uk/news/technology-41188008`,
		},
		{
			id: '0dd06d43-6abe-4cf5-ac94-c2d8d66e9451',
			date: date(4, 'dec', 2019),
			title: en`UK Government Vulnerability Disclosure Initiative`,
			url: url`https://www.ncsc.gov.uk/information/vulnerability-reporting`,
			description: en`responsible disclosure program created with the UK National Cyber Security Center covering all government assets`,
			tags: [work, security],
		},
		{
			id: 'a3777d0d-e747-4bbd-aea5-33c06d61230e',
			date: date(22, 'jan', 2018),
			description: en`advisory position. Provided expertise to UK cyber advisory / defence group on Go and building security analysis systems. Launched world's first government-wide responsible disclosure program.`,
			until: 'ongoing',
			priority: 8,
			tags: [security, work],
			title: en`Application Security Engineer, UK National Cyber Security Centre`,
		},
		{
			id: 'bbd55200-f16a-4193-b704-ced4bf79b9d5',
			date: date(23, 'jul', 2020),
			title: en`Senior Information Security Engineer, Google ISE hardening`,
			description: en`Automated security mitigation, detection and refactoring using compiler technology (“langsec”), SDKs and DSLs (“hardening”) on TypeScript and Java. Google-wide mitigations for Log4Shell, XSS, deserialization attacks. Product security review and design, Google Ads (“FLOC”, “FLEDGE”), Google Cloud, Google's IDE (“Cider”). Research including critical disclosures such as CVE-2022-41034.`,
			tags: [work, security],
			until: date(17, 'mar', 2023), // i dont remember the exact date
		},
		{
			id: '3c32b4fc-94a6-42da-ad19-e77669e63f0e',
			date: date(22, 'jan', 2018),
			priority: 8,
			tags: [gaming, security, accolade],
			title: en`forbes 30 under 30, tech`,
			url: url`https://www.forbes.com/profile/thomas-shadwell`,
			description: en`for my work at Twitch, and on responsible disclosure`,
		},
		{
			id: '6186a21e-a04f-455f-9fc1-776b63d1ebbb',
			date: date(8, 'sep', 2017),
			description: en`vulnerability allowing manipulation of UK tax system`,
			priority: 8,
			tags: [security, writing, disclosure],
			title: en`how to hack the uk tax system, i guess`,
			url: url`https://medium.com/@Zemnmez/how-to-hack-the-uk-tax-system-i-guess-3e84b70f8b`,
		},
		{
			id: 'c22f92e7-570c-4059-8f76-52af78214286',
			date: date(11, 'jul', 2019),
			title: en`National Cyber Security Centre 'Turing' challenge coin`,
			priority: 5,
			tags: [accolade, security],
			url: url`https://twitter.com/zemnmez/status/1149278890969456640`,
			description: en`award for my work on UK government vulnerability disclosure policy and my responsible disclosure of vulnerabilities in the UK tax system.`,
		},
		{
			id: '0bb2bc73-56d9-42ee-bf2e-8e581f885d97',
			date: date(1, 'sep', 2014),
			description: en`first security engineer at the video game streaming website. Designed security architecture for flagship projects including bits, the Twitch API, extensions and Twitch's OIDC / OAuth AuthN/Z systems. Created and defined security relationships and processes. Built Go security static analysis system, security frameworks and libraries`,
			until: date(11, 'jul', 2020),
			priority: 9,
			tags: [software, security, work],
			title: en`Senior Application Security Engineer, Twitch`,
			url: url`https://twitch.tv`,
		},
		{
			id: '3d6ca0b4-febc-44ea-bbd1-1b01cf95b1ec',
			date: date(26, 'dec', 2020),
			title: en`How to Hack Apple ID`,
			url: url`https://zemnmez.medium.com/how-to-hack-apple-id-f3cc9b483a41`,
			tags: [writing, security, disclosure],
			description: en`bypassing cutting-edge web security techniques to hack Apple ID`,
		},
		{
			id: '194784f2-4607-4bff-b96f-56f2e1a29b6f',
			date: date(13, 'aug', 2023),
			title: en`Def Con Black Badge`,
			tags: [accolade, security],
			description: en`the highest award given by the world's largest hacker convention. Awarded for the HackFortress CTF.`,
			url: url`https://defcon.org/html/links/dc-black-badge.html#tab-31`,
		},
		{
			id: '957be17b-5e69-4343-ac27-3697aeee2746',
			date: date(24, 'jul', 2021),
			title: en`Monorepo`,
			tags: [typescript, rust, react, software, code],
			description: en`a polyglot, fully tested, automatically upgraded, automatically versioned, continuously integrated monorepo ecosystem reflecting ideas I had working on hardening at scale at Google.`,
			url: url`https://github.com/zemn-me/monorepo`,
		},
		{
			id: 'f85c3e85-4f0e-49cf-98cf-7042aa91a2c0',
			date: date(6, 'mar', 2023),
			title: en`Login CSRF, VTubeStudio`,
			tags: [security, disclosure],
			description: en`fun little bug to hijack popular streaming application VTubeStudio`,
			url: url`https://twitter.com/VTubeStudio/status/1632733713891983360`,
		},
		{
			id: '9d204846-266d-4dc4-be46-e055b139fdba',
			date: date(11, 'aug', 2023),
			title: en`Visual Studio Code is why I have (Workspace) Trust issues`,
			tags: [security],
			description: en`talk at Def Con by Sonar R&D including original research into VSCode security, reflecting on my own prior art CVE-2022-41034 (not my talk).`,
			url: url`https://media.defcon.org/DEF%20CON%2031/DEF%20CON%2031%20presentations/Thomas%20Chauchefoin%20Paul%20Gerste%20-%20Visual%20Studio%20Code%20is%20why%20I%20have%20%28Workspace%29%20Trust%20issues.pdf`,
		},
		{
			id: 'e76c6572-d156-4f91-994d-b891eba4b771',
			date: date(1, 'nov', 2021),
			title: en`Relocated to San Francisco from London.`,
		},
		{
			id: '1a8b8ecc-784e-4fcc-b008-1b8532942a34',
			date: date(12, 'aug', 2023),
			title: en`Def Con 31 Hack Fortress Champions`,
			description: en`hybrid ctf / esports competition winners.`,
			url: url`https://twitter.com/tf2shmoo/status/1690538453669429248`,
		},
		{
			id: '41b9fa28-bffa-4506-8e86-1bc3b2880c2f',
			date: date(9, 'apr', 2019),
			title: en`IE 11 command switch injection`,
			description: en`in IE11, programs on the user's computer could be launched with arbitrary arguments by running executing the scheme in an iframe. CVE-2019-0764`,
			url: url`https://msrc.microsoft.com/update-guide/en-US/vulnerability/CVE-2019-0764`,
		},
		{
			id: 'db098b2c-fac0-4033-9911-9d6187812b19',
			date: date(25, 'nov', 2019),
			description: en`in Google Chrome, Blink, or Chromium, it was possible to bypass cross-origin restrictions by causing a refresh of a failed cross-origin request. CVE-2019-13664`,
			title: en`Chromium cross-origin bypass`,
			url: url`https://nvd.nist.gov/vuln/detail/CVE-2019-13664`,
		},
		{
			id: '1aced039-3215-472f-aac6-612e5a0a0f16',
			date: date(23, 'oct', 2023),
			title: en`crypto-js PBKDF2 1,000 times weaker than specified in 1993 and 1.3M times weaker than current standard`,
			description: en`Vulnerability in second most popular Javascript cryptography library allowing forgery of digital signatures. CVE-2023-46133`,
			url: url`https://github.com/advisories/GHSA-xwcq-pm8m-c4vf`,
		},
		{
			id: '4ef84524-9e7a-4b2c-a300-2c679424b116',
			date: date(23, 'oct', 2023),
			title: en`crypto-es PBKDF2 1,000 times weaker than specified in 1993 and 1.3M times weaker than current standard`,
			description: en`Vulnerability in maintained fork of most popular Javascript cryptography library allowing forgery of digital signatures. CVE-2023-46233`,
			url: url`https://github.com/advisories/GHSA-mpj8-q39x-wq5h`,
		},
		{
			id: '3d14e688-452b-4903-9634-c4af5a434dea',
			date: date(1, 'jul', 2021),
			title: en`Apple Hall of Fame`,
			description: en`For major security issue covered in 'How to Hack Apple ID'.`,
			url: url`https://support.apple.com/en-gb/HT213636#:~:text=Thomas%20Shadwell%20(%40zemnmez)%20of%20Google`,
		},
		{
			id: '94c6577b-372f-4842-b2c5-1438f16b2eab',
			date: date(28, 'nov', 2023),
			title: en`Member of Technical Staff, Security Product and Platform (PROP), OpenAI`,
			tags: [software, security, work],
		},
		{
			id: '741b6fc1-5c5b-4319-aa9b-36f4b88d7f9a',
			date: date(13, 'jan', 2024),
			title: en`HackFortress Shmoocon 2024 Champions`,
			description: en`Won my favorite CTF at the penultimate Shmoocon.`,
			url: url`https://twitter.com/tf2shmoo/status/1746340146612519239`,
			tags: [accolade, security],
		},
		{
			id: '48ad5d73-e29c-4242-b58b-4e0a29cd1448',
			date: date(13, 'jan', 2024),
			title: en`Hack Fortress @ Shmoocon - SF - RH Duke Shad Hound vs. CluckForce5`,
			url: url`https://www.twitch.tv/videos/2031742297`,
			description: en`Video of the finals of HackFortress @ Shmoocon 2023`,
		},
		// END TOOL ASSISTED SORT
	],
	who: {
		handle: en`zemnmez`,
		fullName: en`Thomas Neil James Shadwell`,
		name: en`Thomas NJ Shadwell`,
		firstName: en`Thomas`,
		lastName: en`Shadwell`,
	},
} as const satisfies Bio;

export const links = new Map(
	Bio.links.map(
		([name, href]) =>
			[
				lang.text(name),
				{
					name: name,
					href,
				},
			] as const
	)
);
