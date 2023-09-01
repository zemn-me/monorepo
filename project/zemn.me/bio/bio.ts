import * as lang from 'ts/react/lang';
import * as time from 'ts/time';

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
	birthdate: Date;
	skills: Text[];
	links: [Text, URL][];
	timeline: Event[];
	who: Who;
}

export type Timeline = Event[];

export interface Who {
	handle: Text;
	fullName: Text;
	name: Text;
}

export type Tag = Text;

export interface Employment {
	since: Date;
	title: Text;
	where: Text;
}

export interface Event {
	date: Date;
	description?: Text;
	tags?: Tag[];
	title: Text;
	url?: URL;
	priority?: number;
	until?: Endpoint;
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

export const Bio: Bio = {
	birthdate: date(17, 'may', 1994),
	links: [
		[en`linkedin`, url`//www.linkedin.com/in/thomas-shadwell-4b333b50`],
		[en`github`, url`//github.com/zemnmez`],
		// probably should have an enable/ disable here at some point
		// [en`twitch`, url`//twitch.tv/zemnmez`],
		[en`twitter`, url`//twitter.com/zemnmez`],
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
			date: date(23, 'nov', 2022),
			description: en`Google research; exploit to remotely take over VSCode and any attached cloud systems. CVE-2022-41034, GHSA-pw56-c55x-cm9m`,
			tags: [security, disclosure],
			title: en`Visual Studio Code: Remote Code Execution`,
			url: url`https://github.com/google/security-research/security/advisories/GHSA-pw56-c55x-cm9m`,
		},

		{
			date: date(14, 'jan', 2019),
			description: en`react helper bindings for d3`,
			priority: 6,
			tags: [software, library, d3, react],
			title: en`reactive-d3`,
			url: url`https://github.com/Zemnmez/reactive-d3`,
		},
		{
			date: date(18, 'feb', 2017),
			description: en`musings on the evolution of design`,
			tags: [writing],
			title: en`Design Evolves By Constraint`,
			url: url`https://medium.com/@Zemnmez/design-evolves-by-constraint-f2d87697d25e`,
		},
		{
			date: date(3, 'jan', 2016),
			description: en`minimal reactive d3.js resistor colour code calculator`,
			priority: 6,
			tags: [software],
			title: en`r.no.ms`,
			url: url`http://r.no.ms`,
		},
		{
			date: date(1, 'apr', 2011),
			description: en`London Real Time Hackathon`,
			priority: 5,
			tags: [software, accolade],
			title: en`Geckoboard Prize`,
			url: url`https://web.archive.org/web/20121113024249/http://Londonrealtime.co.uk/`,
		},
		{
			date: date(25, 'feb', 2020),
			title: en`SVGShot`,
			url: url`https://github.com/Zemnmez/svgshot`,
			description: en`small tool for taking SVG 'screenshots' of webpages`,
			tags: [typescript, code],
		},
		{
			date: date(1, 'sep', 2011),
			description: en`Volunteer role at once largest trading website in the Steam community. Worked on administration of high-profile trades & scams`,
			until: date(1, 'sep', 2014),
			priority: 5,
			tags: [work, gaming],
			title: en`Sr. Admin, TF2Outpost`,
		},
		{
			date: date(5, 'aug', 2011),
			description: en`Rewired State: Parliament`,
			priority: 5,
			tags: [software, accolade],
			title: en`Better understanding of the work of Parliament Prize`,
			url: url`https://web.archive.org/web/20121105174535/http://rewiredstate.org:80/blog/2011/11/press-release-for-rewired-state-parliament`,
		},
		{
			date: date(1, 'feb', 2011),
			description: en`Young Rewired State 2011`,
			priority: 5,
			tags: [software, accolade],
			title: en`Best example of Coding`,
			url: url`https://web.archive.org/web/20120306190316/http://youngrewiredstate.org/2011-08/cant-vote-but-can-put-a-wind-in-governments-sails/`,
		},
		{
			date: date(1, 'feb', 2020),
			title: en`HackFortress Shmoocon 2020 Champions`,
			tags: [accolade, security, gaming],
			description: en`defended title for hybrid gaming ctf`,
		},
		{
			date: date(2, 'aug', 2019),
			title: en`If CORS is just a header, why don’t attackers just ignore it?`,
			url: url`https://medium.com/@Zemnmez/if-cors-is-just-a-header-why-dont-attackers-just-ignore-it-63e57c323cef?source=your_stories_page---------------------------`,
			description: en`article on common security misconceptions around CORS`,
			tags: [writing, security],
		},
		{
			date: date(9, 'aug', 2020),
			title: en`HackFortress DefCon 2020 Champions`,
			tags: [accolade, security],
		},
		{
			date: date(1, 'may', 2012),
			description: en`full stack freelance work building MVPs for London startups and wrangling data for hackathons`,
			until: date(1, 'may', 2014),
			priority: 7,
			tags: [work],
			title: en`Software Engineer, Consultant`,
		},
		{
			date: date(7, 'jan', 2019),
			description: en`react based personal website for 2019`,
			priority: 6,
			tags: [software, react],
			title: en`linear`,
			url: url`https://github.com/Zemnmez/linear`,
		},
		{
			date: date(19, 'oct', 2020),
			title: en`Typescript Union Merging`,
			description: en`Using interface merging to write somewhat decentralised Redux actions`,
			url: url`https://medium.com/@Zemnmez/typescript-union-merging-b2ea332f08f1`,
			tags: [code, typescript, writing],
		},
		{
			title: en`CSVPretty`,
			url: url`https://github.com/Zemnmez/csvpretty`,
			description: en`typescript pretty printer for the CSV format`,
			date: date(23, 'jul', 2019),
			tags: [golang, code],
		},
		{
			date: date(8, 'nov', 2011),
			description: en`Interview on National Hack the Government Day prize (dutch)`,
			priority: 5,
			tags: [software, comment],
			title: nl`MozFest: Rewired State geeft jonge programmeurs een kans`,
			url: url`http://www.denieuwereporter.nl/2011/11/mozfest-rewired-state-geeft-jonge-programmeurs-een-kans/`,
		},
		{
			date: date(1, 'apr', 2011),
			description: en`National Hack the Government Day 2011`,
			priority: 5,
			tags: [software, accolade],
			title: en`Wallace and Gromit Prize`,
			url: url`https://www.theguardian.com/info/developer-blog/2011/apr/05/national-hack-the-government-day-2011`,
		},
		{
			date: date(11, 'apr', 2020),
			title: en`do-sync`,
			description: en`Async to sync library for encapsulated javascript macros`,
			url: url`https://github.com/Zemnmez/do-sync`,
			tags: [code, typescript],
		},
		{
			date: date(16, 'jun', 2019),
			title: en`react-oauth2-hook`,
			url: url`https://github.com/Zemnmez/react-oauth2-hook`,
			description: en`An entirely clientside implementation of an oauth2 implicit client, with React hooks`,
			tags: [react, code, security, typescript],
		},
		{
			date: date(1, 'may', 2020),
			title: en`Why We don't we have UIs like the ones in Neon Genesis`,
			description: en`Exploration of how rendering hardware has affected UI design`,
			url: url`https://medium.com/@Zemnmez/why-we-dont-have-uis-like-the-ones-in-neon-genesis-9b6631dc3714`,
			tags: [writing, design],
		},
		{
			date: date(4, 'jul', 2017),
			description: en`musings on go-specific security gotchas`,
			priority: 5,
			tags: [security, talk],
			title: en`This Will Cut You: Go's Sharper Edges`,
			url: url`https://www.infoq.com/presentations/go-security`,
		},
		{
			date: date(1, 'mar', 2012),
			description: en`charity focused on teaching code literacy. Ran and participated in hackathons for good causes. Taught software engineering to young people`,
			until: date(1, 'mar', 2015),
			priority: 6,
			tags: [software, security, work],
			title: en`Developer, Rewired State`,
		},
		{
			date: date(23, 'nov', 2017),
			description: en`talk at owasp about critical uk tax system flaw in obfuscated system and the 57 day trek to get it fixed`,
			priority: 6,
			tags: [security, talk],
			title: en`how to hack the uk tax system: the talk`,
			url: url`https://twitter.com/zemnmez/status/933847040198574080`,
		},
		{
			date: date(25, 'jan', 2016),
			description: en`unauthorized remote shutdown of Buffalo-made network attached storage devices`,
			priority: 6,
			tags: [security, writing, disclosure],
			title: en`Buffalo NAS Remote Shutdown`,
			url: url`https://packetstormsecurity.com/files/135368`,
		},
		{
			date: date(22, 'apr', 2014),
			description: en`unique developer granted cosmetic item for the video game Team Fortress 2 granted for security issues allowing movement millions of dollars of virtual items between arbitrary accounts via account takeover`,
			priority: 6.5,
			tags: [gaming, security, accolade],
			title: en`Sunbeams Ebenezer`,
			url: url`http://steamcommunity.com/id/both/inventory/#440_2_4818206214`,
		},
		{
			date: date(14, 'dec', 2015),
			description: en`unique developer granted cosmetic item for the video game Team Fortress 2 granted for security issue allowing decryption of all Steam traffic`,
			priority: 6.5,
			tags: [gaming, security, accolade],
			title: en`Burning Flames Finder\u2019s Fee`,
			url: url`https://steamcommunity.com/id/both/inventory/#440_2_4398163918`,
		},
		{
			date: date(20, 'jan', 2019),
			description: en`hybrid ctf / esports competition winners`,
			priority: 6,
			tags: [accolade, security, gaming],
			title: en`hack fortress 2019 champions`,
			url: url`https://twitter.com/tf2shmoo/status/1086785642514796544`,
		},
		{
			date: date(15, 'dec', 2018),
			description: en`Quick article on the security of modern desktop web applications`,
			priority: 7,
			tags: [security, disclosure],
			title: en`\u00dcbersicht Remote Code Execution, Spotify takeover`,
			url: url`https://medium.com/@Zemnmez/%C3%BCbersicht-remote-code-execution-spotify-takeover-a5f6fd6809d0`,
		},
		{
			date: date(12, 'aug', 2019),
			priority: 6,
			tags: [security, gaming, accolade],
			title: en`hack fortress DEFCON 2018 winners`,
			url: url`https://twitter.com/tf2shmoo/status/1028462663368507392`,
		},
		{
			date: date(19, 'oct', 2015),
			description: en`unique developer granted cosmetic item for the video game Team Fortress 2 granted for security issues allowing remote access to computers running the video game`,
			priority: 7,
			tags: [gaming, security, accolade],
			title: en`Nebula Finder\u2019s Fee`,
			url: url`https://steamcommunity.com/id/both/inventory/#440_2_4228772424`,
		},
		{
			date: date(11, 'may', 2016),
			description: en`XSS in Mr Robot official site`,
			priority: 6,
			tags: [security, disclosure, comment],
			title: en`Irony Alert: Hacker Finds Vulnerability In Mr Robot Website`,
			url: url`https://www.forbes.com/sites/thomasbrewster/2016/05/11/flaw-in-mr-robot-website-allowed-facebook-attack/#747437ef6bed`,
		},
		{
			date: date(24, 'jan', 2016),
			description: en`Host based account hijack attack on php-openid`,
			priority: 6,
			tags: [security, writing, disclosure],
			title: en`CVE-2016-2049`,
			url: url`https://cve.mitre.org/cgi-bin/cvetitle.cgi?title:CVE-2016-2049`,
		},
		{
			date: date(16, 'may', 2016),
			description: en`code execution in official Mr Robot site`,
			priority: 7,
			tags: [security, disclosure, comment],
			title: en`'Mr. Robot' Web Weaknesses Left Fans And USA Network Vulnerable, Warns Non-Fictional Hacker`,
			url: url`https://www.forbes.com/sites/thomasbrewster/2016/05/16/mr-robot-imagetragick-usa-network-wide-open-to-hackers/#7d49f6f66d77`,
		},
		{
			date: date(1, 'jan', 2013),
			description: en`international chemistry challenge`,
			priority: 6,
			tags: [science, accolade],
			title: en`7th place Cambridge Chemistry Challenge (C3L6)`,
		},
		{
			date: date(1, 'jan', 2014),
			description: en`international chemistry challenge`,
			priority: 5,
			tags: [science, accolade],
			title: en`5th place, Cambridge Chemistry Challenge (C3L6)`,
		},
		{
			date: date(2, 'sep', 2018),
			title: en`I hacked video games like 300 times and all I got was this stupid talk`,
			tags: [talk, gaming, security],
			description: en`talk at game dev days 2018 in Graz, Austria summarising some security concepts for game developers`,
			url: url`https://www.youtube.com/watch?v=NjMMK-FkTW4&list=PLFqM5L7fs0mO3O3-BBZfA-sHeT86Gesd8&index=15&`,
		},
		{
			date: date(5, 'sep', 2018),
			title: en`Cross-site information assertion leak via Content Security Policy`,
			url: url`https://hackerone.com/reports/16910`,
			description: en`CSP1 information leak allowing efficient deanonymisation of internet users`,
			tags: [security, disclosure],
		},
		{
			date: date(7, 'jul', 2014),
			description: en`exploit using content security policy 1 to steal data on the web`,
			priority: 9,
			tags: [security, writing, disclosure],
			title: en`when security creates insecurity`,
			url: url`http://archive.is/UXD8j`,
		},
		{
			date: date(27, 'apr', 2016),
			description: en`padding oracle based decryption of Steam traffic`,
			priority: 7,
			tags: [security, gaming, disclosure],
			title: en`steam patches broken crypto in wake of replay, padding oracle attacks`,
			url: url`https://threatpost.com/steam-patches-broken-crypto-in-wake-of-replay-padding-oracle-attacks/117691/`,
		},
		{
			date: date(7, 'jan', 2019),
			description: en`vulnerability to remotely access Steam users' computers`,
			priority: 8,
			tags: [gaming, security, accolade],
			title: en`Steam Remote Code Execution`,
			url: url`https://hackerone.com/reports/409850`,
		},
		{
			date: date(7, 'jan', 2019),
			description: en`XSS to RCE on Steam`,
			tags: [security, writing, disclosure],
			title: en`XSS in Steam React Chat Client`,
			url: url`//hackerone.com/reports/409850`,
		},
		{
			date: date(8, 'jan', 2019),
			description: en`news coverage of steam rce`,
			priority: 7,
			tags: [security, disclosure, comment],
			title: en`$7,500 Steam Weakness Let Hackers Take Remote Control Of Gamers' PCs`,
			url: url`https://www.forbes.com/sites/thomasbrewster/2019/01/08/7500-steam-weakness-let-hackers-take-remote-control-of-gamers-pcs`,
		},
		{
			date: date(17, 'may', 2019),
			title: en`Full Steam Ahead: Remotely Executing Code in Modern Desktop Applications`,
			description: en`technical talk at offensive AppSec conference Infiltrate summarising through example research into hybrid web / desktop application security`,
			tags: [en`talk`, security, gaming],
			url: url`https://vimeo.com/335206831`,
		},
		{
			date: date(8, 'sep', 2017),
			description: en`news post on manipulation of UK tax data`,
			priority: 6,
			tags: [security, disclosure, comment],
			title: en`'Serious' security flaws found on official UK tax site`,
			url: url`http://www.bbc.co.uk/news/technology-41188008`,
		},
		{
			date: date(4, 'dec', 2019),
			title: en`UK Government Vulnerability Disclosure Initiative`,
			url: url`https://www.ncsc.gov.uk/information/vulnerability-reporting`,
			description: en`responsible disclosure program created with the UK National Cyber Security Center covering all government assets`,
			tags: [work, security],
		},
		{
			date: date(22, 'jan', 2018),
			description: en`advisory position. Provided expertise to UK cyber advisory / defence group on Go and building security analysis systems. Launched world's first government-wide responsible disclosure program.`,
			until: 'ongoing',
			priority: 8,
			tags: [security, work],
			title: en`Application Security Engineer, UK National Cyber Security Centre`,
		},
		{
			date: date(23, 'jul', 2020),
			title: en`Senior Information Security Engineer, Google ISE hardening`,
			description: en`Automated security mitigation, detection and refactoring using compiler technology (“langsec”), SDKs and DSLs (“hardening”) on TypeScript and Java. Google-wide mitigations for Log4Shell, XSS, deserialization attacks. Product security review and design, Google Ads (“FLOC”, “FLEDGE”), Google Cloud, Google's IDE (“Cider”). Research including critical disclosures such as CVE-2022-41034.`,
			tags: [work, security],
			until: date(17, 'mar', 2023), // i dont remember the exact date
		},
		{
			date: date(22, 'jan', 2018),
			priority: 8,
			tags: [gaming, security, accolade],
			title: en`forbes 30 under 30, tech`,
			url: url`https://www.forbes.com/profile/thomas-shadwell`,
			description: en`for my work at Twitch, and on responsible disclosure`,
		},
		{
			date: date(8, 'sep', 2017),
			description: en`vulnerability allowing manipulation of UK tax system`,
			priority: 8,
			tags: [security, writing, disclosure],
			title: en`how to hack the uk tax system, i guess`,
			url: url`https://medium.com/@Zemnmez/how-to-hack-the-uk-tax-system-i-guess-3e84b70f8b`,
		},
		{
			date: date(11, 'jul', 2019),
			title: en`National Cyber Security Centre 'Turing' challenge coin`,
			priority: 5,
			tags: [accolade, security],
			url: url`https://twitter.com/zemnmez/status/1149278890969456640`,
			description: en`award for my work on UK government vulnerability disclosure policy and my responsible disclosure of vulnerabilities in the UK tax system.`,
		},
		{
			date: date(1, 'sep', 2014),
			description: en`first security engineer at the video game streaming website. Designed security architecture for flagship projects including bits, the Twitch API, extensions and Twitch's OIDC / OAuth AuthN/Z systems. Created and defined security relationships and processes. Built Go security static analysis system, security frameworks and libraries`,
			until: date(11, 'jul', 2020),
			priority: 9,
			tags: [software, security, work],
			title: en`Senior Application Security Engineer, Twitch`,
			url: url`https://twitch.tv`,
		},
		{
			date: date(26, 'dec', 2020),
			title: en`How to Hack Apple ID`,
			url: url`https://zemnmez.medium.com/how-to-hack-apple-id-f3cc9b483a41`,
			tags: [writing, security, disclosure],
			description: en`Bypassing cutting-edge web security techniques to hack Apple ID`,
		},
		{
			date: date(13, 'aug', 2023),
			title: en`Def Con Black Badge`,
			tags: [accolade, security],
			description: en`The highest award given by the world's largest hacker convention. Awarded for the HackFortress CTF.`,
		},
		{
			date: date(24, 'jul', 2021),
			title: en`Monorepo`,
			tags: [typescript, rust, react, software, code],
			description: en`A polyglot, fully tested, automatically upgraded, automatically versioned, continuously integrated monorepo ecosystem reflecting ideas I had working on hardening at scale at Google.`,
			url: url`https://github.com/zemnmez/monorepo`,
		},
		{
			date: date(6, 'mar', 2023),
			title: en`Login CSRF, VTubeStudio`,
			tags: [security, disclosure],
			description: en`Fun little bug to hijack popular streaming application VTubeStudio`,
			url: url`https://twitter.com/VTubeStudio/status/1632733713891983360`,
		},
		{
			date: date(11, 'aug', 2023),
			title: en`Visual Studio Code is why I have (Workspace) Trust issues`,
			tags: [security],
			description: en`Talk at Def Con by Sonar R&D including original research into VSCode security, reflecting on my own prior art CVE-2022-41034.`,
			url: url`https://media.defcon.org/DEF%20CON%2031/DEF%20CON%2031%20presentations/Thomas%20Chauchefoin%20Paul%20Gerste%20-%20Visual%20Studio%20Code%20is%20why%20I%20have%20%28Workspace%29%20Trust%20issues.pdf`,
		},
		{
			date: date(1, 'nov', 2021),
			title: en`Relocated to San Francisco from London.`,
		},
		{
			date: date(12, 'aug', 2023),
			title: en`Def Con 31 Hack Fortress Champions`,
			description: en`hybrid ctf / esports competition winners.`,
			url: url`https://twitter.com/tf2shmoo/status/1690538453669429248`,
		},
		// END TOOL ASSISTED SORT
	],
	who: {
		handle: en`zemnmez`,
		fullName: en`Thomas Neil James Shadwell`,
		name: en`Thomas NJ Shadwell`,
	},
};
