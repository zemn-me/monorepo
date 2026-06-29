import { z } from 'zod';

import { frontmatter as articleCsp } from '#root/mdx/article/2014/csp.js';
import { frontmatter as articleClean } from '#root/mdx/article/2024/clean.js';
import { frontmatter as articleMissing } from '#root/mdx/article/2024/missing.js';
import { frontmatter as articleKasimir } from '#root/mdx/article/2026/kasimir/kasimir.js';
import {
	frontmatter as articleMandarinBench,
} from '#root/mdx/article/2026/mandarin-bench/mandarin-bench.js';
import * as translations from '#root/project/me/zemn/bio/translations.js';
import { ArticleProps } from '#root/project/me/zemn/components/Article/types/article_types.js';
import * as lang from '#root/ts/react/lang/index.js';
import { RelativeURL } from '#root/ts/react/next/Link/relative_url.js';
import * as time from '#root/ts/time/index.js';
import { linkToHighlight } from '#root/ts/url/selection.js';

type Text = lang.Text;
type LocalizedText = Text | lang.TextSelection;
export type LinkCaption = LocalizedText;

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
	readonly skills: readonly LocalizedText[];
	readonly links: readonly (readonly [LinkCaption, URL])[];
	readonly timeline: readonly Event[];
	readonly who: Who;
	readonly email?: readonly string[];
	readonly officialWebsite?: URL;
}

export type Timeline = readonly Event[];

export interface Who {
	readonly handle: Text;
	readonly fullName: Text;
	readonly name: Text;
	readonly firstName: Text;
	readonly lastName: Text;
}

export type Tag = LocalizedText;

export interface Employment {
	readonly since: Date;
	readonly title: LocalizedText;
	readonly where: LocalizedText;
	/**
	 * id we supercede --
	 * Promo, re-org etc.
	 */
	readonly supercedes?: string;
}

export interface Event {
	id: string;
	readonly date: Date;
	readonly since?: Date;
	readonly description?: LocalizedText;
	readonly tags?: readonly Tag[];
	readonly address?: string;
	readonly title: LocalizedText;
	readonly publisher?: LocalizedText;
	readonly url?: URL | RelativeURL;
	readonly priority?: number;
	readonly until?: Endpoint;
	readonly employer?: LocalizedText;
	/**
	 * id we supercede --
	 * Promo, re-org etc.
	 */
	readonly supercedes?: string;
}

export function eventHasStarted(event: Event, now: Date = new Date()): boolean {
	return event.date <= now;
}

// tags
export const gaming = translations.bio_tag_gaming,
	accolade = translations.bio_tag_accolade,
	talk = translations.bio_tag_talk,
	software = translations.bio_tag_software,
	react = translations.bio_tag_react,
	security = translations.bio_tag_security,
	d3 = translations.bio_tag_d3,
	library = translations.bio_tag_library,
	disclosure = translations.bio_tag_disclosure,
	comment = translations.bio_tag_comment,
	work = translations.bio_tag_work,
	writing = translations.bio_tag_writing,
	science = translations.bio_tag_science,
	design = translations.bio_tag_design,
	code = translations.bio_tag_code,
	typescript = translations.bio_tag_typescript,
	nodejs = translations.bio_tag_nodejs,
	golang = translations.bio_tag_golang,
	rust = translations.bio_tag_rust,
	go = translations.bio_tag_go,
	employment = translations.bio_tag_employment;

const zodCanonicaliseArticleMetadata = z
	.object({
		title: z.string(),
		language: z.string(),
		description: z.string().optional(),
		date: time.date.Date,
	})
	.transform(m => ({
		...m,
		date: time.date.parse(m.date),
		title: lang.Text(m.language, m.title),
		description: m.description
			? lang.Text(m.language, m.description)
			: undefined,
	}));

export const bskyDid = `did:plc:gs4i6qqpygcstwez77xsrbbq`;

const canonicaliseArticleMetadata = (
	p: ArticleProps
): Pick<Event, 'date' | 'description' | 'title'> =>
	zodCanonicaliseArticleMetadata.parse(p);

export type BioType = typeof Bio;

export const Bio = {
	officialWebsite: url`https://zemn.me`,
	birthdate: date(17, 'may', 1994),
	email: [
		'thomas@shadwell.im',
		'thomas@metatheory.gg',
		'thomas.shadwell@gmail.com',
		'thomas@openai.com',
	],
	links: [
		[
			translations.bio_link_google_knowledge_graph,
			url`//www.google.com/search?kgmid=/g/11lw7w6zt8`,
		],
		[translations.bio_link_cv, url`https://zemn.me/cv`],
		[
			translations.bio_link_linkedin,
			url`//www.linkedin.com/in/thomas-shadwell-4b333b50`,
		],
		[translations.bio_link_github, url`//github.com/zemnmez`],
		// probably should have an enable/ disable here at some point
		[
			translations.bio_link_bluesky,
			url`//bsky.app/profile/${bskyDid}`,
		],
		[translations.bio_link_twitter, url`//twitter.com/zemnmez`],
		[translations.bio_link_youtube, url`//youtube.com/zemnmez`],
		[translations.bio_link_twitch, url`//twitch.tv/zemnmez`],
		[translations.bio_link_forbes, url`//www.forbes.com/profile/thomas-shadwell/`],
	],
	skills: [
		translations.bio_skill_go,
		translations.bio_skill_typescript,
		translations.bio_skill_python,
		translations.bio_skill_graphql,
		translations.bio_skill_static_analysis,
		translations.bio_skill_javascript,
		translations.bio_skill_react,
		translations.bio_skill_d3,
		translations.bio_skill_bash,
		translations.bio_skill_ruby,
		translations.bio_skill_appsec_arch,
		translations.bio_skill_electron,
		translations.bio_skill_aws,
		translations.bio_skill_pentesting,
		translations.bio_skill_code_review,
		translations.bio_skill_cryptography,
		translations.bio_skill_reverse_engineering,
		translations.bio_skill_starlark,
		translations.bio_skill_bazel,
	],
	timeline: [
		{
			id: 'ac4f5232-f576-4a85-b1dc-c113b3eee61e',
			...canonicaliseArticleMetadata(articleMandarinBench),
			publisher: translations.bio_publisher_zemn_me,
			tags: [writing, software],
			url: new RelativeURL('/article/2026/mandarin-bench'),
		},
		{
			id: '86c449a3-eb95-462e-9746-e99388376d31',
			description: translations.bio_talk_stanford_prompt_injection_description,
			address:
				'Frances C. Arrillaga Alumni Center, 326 Galvez St, Stanford, CA 94305',
			title: translations.bio_talk_real_world_agentic_ai_title,
			publisher: translations.bio_publisher_real_world_ai_security,
			date: date(23, 'jun', 2026), // TBD
			url: linkToHighlight(
				url`https://seclab.stanford.edu/RealWorldAIsec/`,
				{
					start: 'Thomas Shadwell',
				}
			),
			tags: [talk, work, security],
		},
		{
			id: '431c28bb-a3ef-48a3-9c66-5e42fc4d954c',
			description:
				translations.bio_talk_defcon_singapore_prompt_injection_description,
			address: 'Marina Bay Sands, 10 Bayfront Ave, Singapore 018956',
			title: translations.bio_talk_real_world_agentic_ai_title,
			publisher: translations.bio_publisher_defcon_singapore,
			date: date(30, 'apr', 2026),
			url: url`https://defcon.org/html/defcon-singapore/dc-singapore-talks.html#:~:text=Beyond%20Prompt%20Injection%3A%20Agentic%20AI%20Attacks%20in%20the%20Real%20World`,
			tags: [talk, work, security],
		},
		{
			id: '0a5c0765-673b-4658-8b7c-d63f860fdebb',
			...canonicaliseArticleMetadata(articleKasimir),
			publisher: translations.bio_publisher_zemn_me,
			tags: [writing],
			url: new RelativeURL('/article/2026/kasimir'),
		},
		{
			id: 'cc77fee4-fdb1-443b-b7e2-7e8996ee5e0e',
			...canonicaliseArticleMetadata(articleMissing),
			publisher: translations.bio_publisher_zemn_me,
			tags: [writing],
			url: new RelativeURL('/article/2024/missing'),
		},
		{
			id: 'ab290485-ae49-4455-af28-674d5fb00fa8',
			...canonicaliseArticleMetadata(articleClean),
			publisher: translations.bio_publisher_zemn_me,
			tags: [writing],
			url: new RelativeURL('/article/2024/clean'),
		},
		{
			id: 'bda2ee54-67ba-4650-887c-78240143a825',
			date: date(23, 'nov', 2022),
			description: translations.bio_vscode_rce_description,
			tags: [security, disclosure],
			title: translations.bio_vscode_rce_title,
			publisher: translations.bio_publisher_github_security_advisory,
			url: url`https://github.com/google/security-research/security/advisories/GHSA-pw56-c55x-cm9m`,
		},

		{
			id: '93de4b1d-0501-4839-b735-66ff8db48aca',
			date: date(14, 'jan', 2019),
			description: translations.bio_reactive_d3_description,
			priority: 6,
			tags: [software, library, d3, react],
			title: translations.bio_reactive_d3_title,
			url: url`https://github.com/Zemnmez/reactive-d3`,
		},
		{
			id: '73ee7f25-a947-4d86-8efe-0ba52c105b94',
			date: date(18, 'feb', 2017),
			description: translations.bio_design_evolves_description,
			tags: [writing],
			title: translations.bio_design_evolves_title,
			url: url`https://medium.com/@Zemnmez/design-evolves-by-constraint-f2d87697d25e`,
		},
		{
			id: 'b0e4bf15-c630-4804-b1db-713cd79d4633',
			date: date(3, 'jan', 2016),
			description: translations.bio_rnoms_description,
			priority: 6,
			tags: [software],
			title: translations.bio_rnoms_title,
			url: url`http://r.no.ms`,
		},
		{
			id: 'a3363960-8fa3-4c5d-b434-c99d4c8b5519',
			date: date(1, 'apr', 2011),
			description: translations.bio_geckoboard_description,
			priority: 5,
			tags: [software, accolade],
			title: translations.bio_geckoboard_title,
			url: url`https://web.archive.org/web/20121113024249/http:%2F%2Flondonrealtime.co.uk/`,
		},
		{
			id: 'faf30607-fb52-44b7-a331-13d2abf3ffa7',
			date: date(25, 'feb', 2020),
			title: translations.bio_svgshot_title,
			url: url`https://github.com/Zemnmez/svgshot`,
			description: translations.bio_svgshot_description,
			tags: [typescript, code],
		},
		{
			id: '299714d5-7580-4889-94b2-0c71b2e1ca9c',
			date: date(1, 'sep', 2011),
			description: translations.bio_tf2outpost_description,
			until: date(1, 'sep', 2014),
			priority: 5,
			tags: [work, gaming],
			title: translations.bio_tf2outpost_title,
		},
		{
			id: '10750828-785a-491e-bd00-dad3c886fd01',
			date: date(5, 'aug', 2011),
			description: translations.bio_rewired_state_parliament_description,
			priority: 5,
			tags: [software, accolade],
			title: translations.bio_parliament_prize_title,
			url: url`https://web.archive.org/web/20121105174535/http:%2F%2Frewiredstate.org:80/blog/2011/11/press-release-for-rewired-state-parliament`,
		},
		{
			id: '963e6a0a-d279-4838-a2d6-2445a0ec97e4',
			date: date(1, 'feb', 2011),
			description: translations.bio_young_rewired_state_description,
			priority: 5,
			tags: [software, accolade],
			title: translations.bio_best_example_coding_title,
			publisher: translations.bio_publisher_young_rewired_state,
			url: url`https://web.archive.org/web/20120306190316/http:%2F%2Fyoungrewiredstate.org/2011-08/cant-vote-but-can-put-a-wind-in-governments-sails/`,
		},
		{
			id: 'e4ad85a6-fee3-4824-aadc-3963ef30dcb9',
			date: date(1, 'feb', 2020),
			title: translations.bio_hackfortress_champions_title,
			publisher: translations.bio_publisher_shmoocon,
			tags: [accolade, security, gaming],
			description: translations.bio_hackfortress_defended_description,
		},
		{
			id: 'befbb9a3-5499-4f45-b251-fa899c178b4d',
			date: date(2, 'aug', 2019),
			title: translations.bio_cors_header_title,
			url: url`https://medium.com/@Zemnmez/if-cors-is-just-a-header-why-dont-attackers-just-ignore-it-63e57c323cef?source=your_stories_page---------------------------`,
			description: translations.bio_cors_header_description,
			tags: [writing, security],
		},
		{
			id: '9195a7e3-b02f-4eb5-8b47-6ae7a9900800',
			date: date(9, 'aug', 2020),
			title: translations.bio_hackfortress_champions_title,
			publisher: translations.bio_publisher_defcon,
			tags: [accolade, security, gaming],
		},
		{
			id: '169b8cda-5634-49fd-9f96-cce5566bb545',
			date: date(1, 'may', 2012),
			description: translations.bio_consultant_description,
			until: date(1, 'may', 2014),
			priority: 7,
			tags: [work, employment],
			title: translations.bio_consultant_title,
		},
		{
			id: 'ace0faea-313d-49f0-bbb0-9ab908fb956a',
			date: date(7, 'jan', 2019),
			description: translations.bio_linear_description,
			priority: 6,
			tags: [software, react],
			title: translations.bio_linear_title,
			url: url`https://github.com/Zemnmez/linear`,
		},
		{
			id: '763a0f63-bf83-4fef-9693-6cf89804f583',
			date: date(19, 'oct', 2020),
			title: translations.bio_typescript_union_merging_title,
			description: translations.bio_typescript_union_merging_description,
			url: url`https://medium.com/@Zemnmez/typescript-union-merging-b2ea332f08f1`,
			tags: [code, typescript, writing],
		},
		{
			id: '150422cc-71bc-444e-bfdb-f16453f4d70a',
			title: translations.bio_csvpretty_title,
			url: url`https://github.com/Zemnmez/csvpretty`,
			description: translations.bio_csvpretty_description,
			date: date(23, 'jul', 2019),
			tags: [golang, code],
		},
		{
			id: '214f6425-d041-4d81-824e-737d6b3cd2df',
			date: date(8, 'nov', 2011),
			description: translations.bio_mozfest_interview_description,
			priority: 5,
			tags: [software, comment],
			title: nl`MozFest: Rewired State geeft jonge programmeurs een kans`,
			publisher: translations.bio_publisher_de_nieuwe_reporter,
			url: url`http://www.denieuwereporter.nl/2011/11/mozfest-rewired-state-geeft-jonge-programmeurs-een-kans/`,
		},
		{
			id: '6b7e92fb-bb5d-40ec-8210-2e4a28e54e66',
			date: date(1, 'apr', 2011),
			description: translations.bio_national_hack_government_description,
			priority: 5,
			tags: [software, accolade],
			title: translations.bio_wallace_gromit_prize_title,
			url: url`https://www.theguardian.com/info/developer-blog/2011/apr/05/national-hack-the-government-day-2011`,
		},
		{
			id: '08e89c21-4532-4a6d-af34-39909e30fe82',
			date: date(11, 'apr', 2020),
			title: translations.bio_do_sync_title,
			description: translations.bio_do_sync_description,
			url: url`https://github.com/Zemnmez/do-sync`,
			tags: [code, typescript],
		},
		{
			id: '7196a47d-d9f9-442f-84dd-31e2fcf76e77',
			date: date(16, 'jun', 2019),
			title: translations.bio_react_oauth2_hook_title,
			url: url`https://github.com/Zemnmez/react-oauth2-hook`,
			description: translations.bio_react_oauth2_hook_description,
			tags: [react, code, security, typescript],
		},
		{
			id: '0943b965-3c14-4bb9-b1c4-57a3a5135d89',
			date: date(1, 'may', 2020),
			title: translations.bio_neon_genesis_ui_title,
			description: translations.bio_neon_genesis_ui_description,
			url: url`https://medium.com/@Zemnmez/why-we-dont-have-uis-like-the-ones-in-neon-genesis-9b6631dc3714`,
			tags: [writing, design],
		},
		{
			id: 'd3c0644d-82a4-49cb-ae5e-a75d36779232',
			date: date(4, 'jul', 2017),
			description: translations.bio_go_sharper_edges_description,
			priority: 5,
			tags: [security, talk],
			title: translations.bio_go_sharper_edges_title,
			publisher: translations.bio_publisher_infoq,
			url: url`https://www.infoq.com/presentations/go-security`,
		},
		{
			id: 'f775df0d-070c-4a96-accc-5f6b4fd60e71',
			date: date(1, 'mar', 2012),
			description: translations.bio_rewired_state_developer_description,
			until: date(1, 'mar', 2015),
			priority: 6,
			tags: [software, security, work],
			title: translations.bio_rewired_state_developer_title,
		},
		{
			id: '886812e0-cc54-40a8-88ef-a23c1ae35390',
			date: date(23, 'nov', 2017),
			description: translations.bio_tax_system_talk_description,
			priority: 6,
			tags: [security, talk],
			title: translations.bio_tax_system_talk_title,
			publisher: translations.bio_publisher_owasp,
			url: url`https://twitter.com/zemnmez/status/933847040198574080`,
		},
		{
			id: '12939520-a1eb-420d-bd2f-3fbe0922d66d',
			date: date(25, 'jan', 2016),
			description: translations.bio_buffalo_nas_description,
			priority: 6,
			tags: [security, writing, disclosure],
			title: translations.bio_buffalo_nas_title,
			publisher: translations.bio_publisher_packet_storm,
			url: url`https://packetstormsecurity.com/files/135368`,
		},
		{
			id: '9fd25be4-62d1-4b48-ab9f-4c3357357674',
			date: date(22, 'apr', 2014),
			description: translations.bio_tf2_account_takeover_description,
			priority: 6.5,
			tags: [gaming, security, accolade],
			title: translations.bio_tf2_sunbeams_title,
			publisher: translations.bio_publisher_valve,
			url: url`http://steamcommunity.com/id/both/inventory/#440_2_4818206214`,
		},
		{
			id: '4a091ea1-6e55-424e-9bdf-59fbd7fcb9d6',
			date: date(14, 'dec', 2015),
			description: translations.bio_tf2_steam_decryption_description,
			priority: 6.5,
			tags: [gaming, security, accolade],
			title: translations.bio_tf2_finders_fee_title,
			publisher: translations.bio_publisher_valve,
			url: url`https://steamcommunity.com/id/both/inventory/#440_2_4398163918`,
		},
		{
			id: '1bb3ddd1-bdab-4eca-97e2-5e2b50323136',
			date: date(20, 'jan', 2019),
			description: translations.bio_hackfortress_winners_description,
			priority: 6,
			tags: [accolade, security, gaming],
			title: translations.bio_hackfortress_champions_title,
			publisher: translations.bio_publisher_shmoocon,
			url: url`https://twitter.com/tf2shmoo/status/1086785642514796544`,
		},
		{
			id: 'a0113940-008d-45e0-a279-ad3d417c7171',
			date: date(15, 'dec', 2018),
			description: translations.bio_ubersicht_spotify_description,
			priority: 7,
			tags: [security, disclosure],
			title: translations.bio_ubersicht_spotify_title,
			url: url`https://medium.com/@Zemnmez/%C3%BCbersicht-remote-code-execution-spotify-takeover-a5f6fd6809d0`,
		},
		{
			id: 'a0b8e856-400c-4b85-9407-4bbaa8e57783',
			date: date(12, 'aug', 2018),
			priority: 6,
			tags: [security, gaming, accolade],
			title: translations.bio_hackfortress_champions_title,
			publisher: translations.bio_publisher_defcon,
			url: url`https://twitter.com/tf2shmoo/status/1028462663368507392`,
		},
		{
			id: '214fcf06-69b5-4eb2-a5d3-882e13c42071',
			date: date(19, 'oct', 2015),
			description: translations.bio_tf2_remote_access_item_description,
			priority: 7,
			tags: [gaming, security, accolade],
			title: translations.bio_tf2_finders_fee_title,
			publisher: translations.bio_publisher_valve,
			url: url`https://steamcommunity.com/id/both/inventory/#440_2_4228772424`,
		},
		{
			id: '3ab05545-8d7b-47d7-9dca-6f5582a806d8',
			date: date(11, 'may', 2016),
			description: translations.bio_mr_robot_code_execution_description,
			priority: 6,
			tags: [security, disclosure, comment],
			title: translations.bio_mr_robot_forbes_title,
			publisher: translations.bio_publisher_forbes,
			url: url`https://www.forbes.com/sites/thomasbrewster/2016/05/11/flaw-in-mr-robot-website-allowed-facebook-attack/#747437ef6bed`,
		},
		{
			id: '08426500-28e9-4398-8156-102df7dda51e',
			date: date(24, 'jan', 2016),
			description: translations.bio_php_openid_description,
			priority: 6,
			tags: [security, writing, disclosure],
			title: translations.bio_cve_2016_2049_title,
			publisher: translations.bio_publisher_nvd,
			url: url`https://nvd.nist.gov/vuln/detail/CVE-2016-2049`,
		},
		{
			id: 'aab4593b-9c81-444e-b607-e6f02b812f14',
			date: date(16, 'may', 2016),
			description: translations.bio_mr_robot_rce_description,
			priority: 7,
			tags: [security, disclosure, comment],
			title: translations.bio_mr_robot_usa_title,
			publisher: translations.bio_publisher_forbes,
			url: url`https://www.forbes.com/sites/thomasbrewster/2016/05/16/mr-robot-imagetragick-usa-network-wide-open-to-hackers/#7d49f6f66d77`,
		},
		{
			id: '24896136-580f-460b-a1d3-56f5ba92ae17',
			date: date(1, 'jan', 2013),
			priority: 6,
			tags: [science, accolade],
			title: translations.bio_cambridge_chemistry_7th_title,
			publisher: translations.bio_publisher_university_cambridge,
		},
		{
			id: '74086941-7c37-4f3e-af9b-4cc8e8bbc749',
			date: date(1, 'jan', 2014),
			priority: 5,
			tags: [science, accolade],
			title: translations.bio_cambridge_chemistry_5th_title,
			publisher: translations.bio_publisher_university_cambridge,
		},
		{
			id: '7aa346f4-31b3-41fa-9844-58a4be83b050',
			date: date(2, 'sep', 2018),
			title: translations.bio_game_dev_days_title,
			publisher: translations.bio_publisher_game_dev_days,
			tags: [talk, gaming, security],
			description: translations.bio_game_dev_days_description,
			url: url`https://www.youtube.com/watch?v=NjMMK-FkTW4&list=PLFqM5L7fs0mO3O3-BBZfA-sHeT86Gesd8&index=15&`,
		},
		{
			id: '91956c2c-ebb6-45a1-aca0-065c3cc4b003',
			date: date(5, 'sep', 2018),
			title: translations.bio_csp_info_leak_title,
			publisher: translations.bio_publisher_hackerone,
			url: url`https://hackerone.com/reports/16910`,
			description: translations.bio_csp_info_leak_description,
			tags: [security, disclosure],
		},
		{
			id: 'f6bfd6fd-a84f-449d-90f9-218a55f22c35',
			description: translations.bio_csp_article_description,
			priority: 9,
			tags: [security, writing, disclosure],
			...canonicaliseArticleMetadata(articleCsp),
			publisher: translations.bio_publisher_zemn_me,
			url: new RelativeURL('/article/2014/csp'),
		},
		{
			id: 'd4b51ac9-107c-4e83-b07f-0cffa34255f6',
			date: date(27, 'apr', 2016),
			description: translations.bio_steam_padding_oracle_description,
			priority: 7,
			tags: [security, gaming, disclosure, comment],
			title: translations.bio_steam_padding_oracle_title,
			publisher: translations.bio_publisher_threatpost,
			url: url`https://threatpost.com/steam-patches-broken-crypto-in-wake-of-replay-padding-oracle-attacks/117691/`,
		},
		{
			id: 'fdee36cb-45fa-4d94-8575-e3e19ac2ed09',
			date: date(7, 'jan', 2019),
			description: translations.bio_steam_rce_description,
			priority: 8,
			tags: [gaming, security, disclosure],
			title: translations.bio_steam_rce_title,
			publisher: translations.bio_publisher_hackerone,
			url: url`https://hackerone.com/reports/409850`,
		},
		{
			id: '440b0daa-bb07-44e0-81a6-7a51eda0d9b5',
			date: date(7, 'jan', 2019),
			description: translations.bio_steam_chat_xss_description,
			tags: [security, writing, disclosure],
			title: translations.bio_steam_chat_xss_title,
			publisher: translations.bio_publisher_hackerone,
			url: url`//hackerone.com/reports/409850`,
		},
		{
			id: '98835628-87ee-435f-bfbf-4d44540b0b94',
			date: date(8, 'jan', 2019),
			description: translations.bio_steam_forbes_description,
			priority: 7,
			tags: [security, disclosure, comment],
			title: translations.bio_steam_forbes_title,
			publisher: translations.bio_publisher_forbes,
			url: url`https://www.forbes.com/sites/thomasbrewster/2019/01/08/7500-steam-weakness-let-hackers-take-remote-control-of-gamers-pcs`,
		},
		{
			id: '1028217a-3167-44ce-af82-7e0b23847471',
			date: date(17, 'may', 2019),
			title: translations.bio_full_steam_ahead_title,
			publisher: translations.bio_publisher_infiltrate,
			description: translations.bio_full_steam_ahead_description,
			tags: [talk, security, gaming],
			url: url`https://vimeo.com/335206831`,
		},
		{
			id: '9160d646-f61a-4dd2-9533-84d176e65300',
			date: date(8, 'sep', 2017),
			description: translations.bio_bbc_tax_description,
			priority: 6,
			tags: [security, disclosure, comment],
			title: translations.bio_bbc_tax_title,
			publisher: translations.bio_publisher_bbc_news,
			url: url`http://www.bbc.co.uk/news/technology-41188008`,
		},
		{
			id: '0dd06d43-6abe-4cf5-ac94-c2d8d66e9451',
			date: date(4, 'dec', 2019),
			title: translations.bio_uk_vdp_title,
			url: url`https://www.ncsc.gov.uk/information/vulnerability-reporting`,
			description: translations.bio_uk_vdp_description,
			tags: [security], // maybe separate 'employment' and 'work'?
		},
		{
			id: 'a3777d0d-e747-4bbd-aea5-33c06d61230e',
			date: date(22, 'jan', 2018),
			description: translations.bio_ncsc_description,
			until: date(23, 'nov', 2021),
			priority: 8,
			tags: [security, work],
			title: translations.bio_role_ncsc_title,
		},
		{
			id: 'bbd55200-f16a-4193-b704-ced4bf79b9d5',
			date: date(23, 'jul', 2020),
			title: translations.bio_role_google_title,
			description: translations.bio_role_google_description,
			tags: [work, security, employment],
			employer: translations.bio_employer_google,
			url: url`https://google.com`,
			until: date(17, 'mar', 2023), // i dont remember the exact date
		},
		{
			id: '3c32b4fc-94a6-42da-ad19-e77669e63f0e',
			date: date(22, 'jan', 2018),
			priority: 8,
			tags: [gaming, security, accolade],
			title: translations.bio_forbes_30_under_30_title,
			publisher: translations.bio_publisher_forbes,
			url: url`https://www.forbes.com/profile/thomas-shadwell`,
			description: translations.bio_forbes_30_under_30_description,
		},
		{
			id: '6186a21e-a04f-455f-9fc1-776b63d1ebbb',
			date: date(8, 'sep', 2017),
			description: translations.bio_tax_system_article_description,
			priority: 8,
			tags: [security, writing, disclosure],
			title: translations.bio_tax_system_article_title,
			url: url`https://medium.com/@Zemnmez/how-to-hack-the-uk-tax-system-i-guess-3e84b70f8b`,
		},
		{
			id: 'c22f92e7-570c-4059-8f76-52af78214286',
			date: date(11, 'jul', 2019),
			title: translations.bio_ncsc_turing_coin_title,
			publisher: translations.bio_publisher_uk_ncsc,
			priority: 5,
			tags: [accolade, security],
			url: url`https://twitter.com/zemnmez/status/1149278890969456640`,
			description: translations.bio_ncsc_turing_coin_description,
		},
		{
			id: '0bb2bc73-56d9-42ee-bf2e-8e581f885d97',
			date: date(1, 'sep', 2014),
			description: translations.bio_twitch_description,
			until: date(11, 'jul', 2020),
			priority: 9,
			tags: [software, security, work, employment],
			employer: translations.bio_employer_twitch,
			title: translations.bio_role_twitch_title,
			url: url`https://twitch.tv`,
		},
		{
			id: '3d6ca0b4-febc-44ea-bbd1-1b01cf95b1ec',
			date: date(26, 'dec', 2020),
			title: translations.bio_apple_id_title,
			url: url`https://zemnmez.medium.com/how-to-hack-apple-id-f3cc9b483a41`,
			tags: [writing, security, disclosure],
			description: translations.bio_apple_id_description,
		},
		{
			id: '194784f2-4607-4bff-b96f-56f2e1a29b6f',
			date: date(13, 'aug', 2023),
			title: translations.bio_black_badge_title,
			publisher: translations.bio_publisher_defcon,
			tags: [accolade, security],
			description: translations.bio_black_badge_description,
			url: url`https://defcon.org/html/links/dc-black-badge.html#tab-31`,
		},
		{
			id: '957be17b-5e69-4343-ac27-3697aeee2746',
			date: date(24, 'jul', 2021),
			title: translations.bio_monorepo_title,
			tags: [typescript, rust, react, software, code],
			description: translations.bio_monorepo_description,
			url: url`https://github.com/zemn-me/monorepo`,
		},
		{
			id: 'f85c3e85-4f0e-49cf-98cf-7042aa91a2c0',
			date: date(6, 'mar', 2023),
			title: translations.bio_vtube_login_csrf_title,
			publisher: translations.bio_publisher_vtube_studio,
			tags: [security, disclosure],
			description: translations.bio_vtube_login_csrf_description,
			url: url`https://twitter.com/VTubeStudio/status/1632733713891983360`,
		},
		{
			id: '9d204846-266d-4dc4-be46-e055b139fdba',
			date: date(11, 'aug', 2023),
			title: translations.bio_vscode_workspace_trust_title,
			publisher: translations.bio_publisher_defcon_31,
			tags: [security, comment],
			description: translations.bio_vscode_workspace_trust_description,
			url: url`https://media.defcon.org/DEF%20CON%2031/DEF%20CON%2031%20presentations/Thomas%20Chauchefoin%20Paul%20Gerste%20-%20Visual%20Studio%20Code%20is%20why%20I%20have%20%28Workspace%29%20Trust%20issues.pdf`,
		},
		{
			id: 'e76c6572-d156-4f91-994d-b891eba4b771',
			date: date(1, 'nov', 2021),
			title: translations.bio_relocated_sf_title,
		},
		{
			id: '1a8b8ecc-784e-4fcc-b008-1b8532942a34',
			date: date(12, 'aug', 2023),
			title: translations.bio_hackfortress_champions_title,
			publisher: translations.bio_publisher_defcon,
			description: translations.bio_hackfortress_winners_description,
			tags: [accolade, security, gaming],
			url: url`https://twitter.com/tf2shmoo/status/1690538453669429248`,
		},
		{
			id: '41b9fa28-bffa-4506-8e86-1bc3b2880c2f',
			date: date(9, 'apr', 2019),
			title: translations.bio_ie11_command_switch_title,
			publisher: translations.bio_publisher_msrc,
			description: translations.bio_ie11_command_switch_description,
			url: url`https://msrc.microsoft.com/update-guide/en-US/vulnerability/CVE-2019-0764`,
		},
		{
			id: 'db098b2c-fac0-4033-9911-9d6187812b19',
			date: date(25, 'nov', 2019),
			description: translations.bio_chromium_cross_origin_description,
			title: translations.bio_chromium_cross_origin_title,
			publisher: translations.bio_publisher_nvd,
			url: url`https://nvd.nist.gov/vuln/detail/CVE-2019-13664`,
		},
		{
			id: '1aced039-3215-472f-aac6-612e5a0a0f16',
			date: date(23, 'oct', 2023),
			title: translations.bio_crypto_js_pbkdf2_title,
			publisher: translations.bio_publisher_github_advisory_database,
			description: translations.bio_crypto_js_pbkdf2_description,
			url: url`https://github.com/advisories/GHSA-xwcq-pm8m-c4vf`,
		},
		{
			id: '4ef84524-9e7a-4b2c-a300-2c679424b116',
			date: date(23, 'oct', 2023),
			title: translations.bio_crypto_es_pbkdf2_title,
			publisher: translations.bio_publisher_github_advisory_database,
			description: translations.bio_crypto_es_pbkdf2_description,
			url: url`https://github.com/advisories/GHSA-mpj8-q39x-wq5h`,
		},
		{
			id: '3d14e688-452b-4903-9634-c4af5a434dea',
			date: date(1, 'jul', 2021),
			title: translations.bio_apple_hall_of_fame_title,
			description: translations.bio_apple_hall_of_fame_description,
			url: url`https://support.apple.com/en-gb/HT213636#:~:text=Thomas%20Shadwell%20(%40zemnmez)%20of%20Google`,
		},
		{
			id: 'e5c48dff-db0d-4731-99c2-48b57a13c309',
			date: date(1, 'sep', 2024),
			title: translations.bio_role_openai_appsec_title,
			supercedes: '94c6577b-372f-4842-b2c5-1438f16b2eab',
			url: url`https://openai.com`,
			tags: [software, security, work, employment],
			description: translations.bio_openai_appsec_description,
			employer: translations.bio_employer_openai,
		},
		{
			id: '94c6577b-372f-4842-b2c5-1438f16b2eab',
			date: date(28, 'nov', 2023),
			until: date(1, 'sep', 2024),
			title: translations.bio_role_openai_prop_title,
			url: url`https://openai.com`,
			tags: [software, security, work, employment],
			employer: translations.bio_employer_openai,
		},
		{
			id: '741b6fc1-5c5b-4319-aa9b-36f4b88d7f9a',
			date: date(13, 'jan', 2024),
			title: translations.bio_hackfortress_champions_title,
			publisher: translations.bio_publisher_shmoocon,
			url: url`https://twitter.com/tf2shmoo/status/1746340146612519239`,
			tags: [accolade, security],
		},
		{
			id: '48ad5d73-e29c-4242-b58b-4e0a29cd1448',
			date: date(13, 'jan', 2024),
			title: translations.bio_hackfortress_finals_title,
			publisher: translations.bio_publisher_shmoocon,
			url: url`https://youtu.be/z-XiVKuQOtc`,
			description: translations.bio_hackfortress_finals_description,
		},
		{
			id: 'c90df85a-3896-47a3-8b0c-d1fed081e0c5',
			date: date(8, 'dec', 2010),
			title: translations.bio_assistant_obstetrician_title,
			description: translations.bio_assistant_obstetrician_description,
			employer: translations.bio_employer_royal_free,
			tags: [science, work],
			until: date(8, 'dec', 2010),
		},
		{
			id: '0ce91f95-6bbf-4c9b-8142-9835c3c7cf4f',
			date: date(1, 'jan', 2013),
			title: translations.bio_parmiters_sixth_form_title,
			description: translations.bio_parmiters_sixth_form_description,
		},
		{
			id: 'eb759cc9-2831-4b88-85d6-a194de1d0141',
			date: date(7, 'jul', 2009),
			title: translations.bio_ict_support_title,
			description: translations.bio_ict_support_description,
			until: date(7, 'sep', 2009),
			tags: [work, employment],
			employer: translations.bio_employer_the_grove,
		},
		{
			id: 'fd4eccdd-b761-43b3-ad6e-a4b6b68db37c',
			date: date(1, 'jan', 2010),
			title: translations.bio_parmiters_secondary_title,
			description: translations.bio_parmiters_secondary_description,
		},
		{
			date: date(7, 'nov', 2025),
			title: translations.bio_prompt_injections_title,
			publisher: translations.bio_publisher_openai,
			url: url`https://openai.com/index/prompt-injections/`,
			id: '2bc4c96c-b278-4363-a3ec-2f6b6c031573',
			description: translations.bio_prompt_injections_description,
			tags: [writing, security, work],
		},
		{
			date: date(13, 'may', 2024),
			title: translations.bio_gpt4o_title,
			publisher: translations.bio_publisher_openai,
			url: linkToHighlight(
				url`https://openai.com/gpt-4o-contributions/`,
				{
					start: 'Thomas Shadwell',
				}
			),
			id: 'b220c42b-6593-44cd-83e3-e26a4bf35c47',
			description: translations.bio_gpt4o_description,
		},
		{
			date: date(3, 'oct', 2024),
			title: translations.bio_chatgpt_canvas_title,
			url: linkToHighlight(
				url`https://openai.com/index/introducing-canvas`,
				{
					start: 'Thomas Shadwell',
				}
			),
			id: 'c1e3a0c2-8430-4703-a53d-6fe4c26a83f1',
			description: translations.bio_chatgpt_canvas_description,
		},
		{
			date: date(7, 'aug', 2025),
			title: translations.bio_gpt5_title,
			url: linkToHighlight(
				url`https://openai.com/index/introducing-gpt-5`,
				{
					start: 'Thomas Shadwell',
				}
			),
			id: 'c0c4240c-344b-44f5-9788-4ace389f81ce',
			description: translations.bio_gpt5_description,
		},
		{
			date: date(18, 'oct', 2025),
			title: translations.bio_agent_security_panel_title,
			publisher: translations.bio_publisher_ai_agent_security_summit_sf,
			url: linkToHighlight(
				url`https://zenity.io/resources/events/ai-agent-security-summit-2025`,
				{
					start: 'Thomas Shadwell',
				}
			),
			id: '11a2ca4e-d899-4a62-8e17-2d91082544ec',
			description: translations.bio_agent_security_panel_description,
			tags: [talk, work, security],
		},
		{
			date: date(21, 'oct', 2025),
			title: translations.bio_chatgpt_atlas_title,
			publisher: translations.bio_publisher_openai,
			description: translations.bio_chatgpt_atlas_description,
			id: `32dda71c-fa45-4652-b09d-3635a27b8f55`,
			url: url`https://chatgpt.com/atlas`,
			tags: [work, security],
		},
		{
			date: date(28, 'jan', 2026),
			title: translations.bio_url_exfil_paper_title,
			publisher: translations.bio_publisher_openai,
			id: '8f87f6ca-2446-4a04-8218-2aa2493cb77d',
			description: translations.bio_url_exfil_paper_description,
			url: url`https://cdn.openai.com/pdf/dd8e7875-e606-42b4-80a1-f824e4e11cf4/prevent-url-data-exfil.pdf`,
			tags: [work, security, writing],
		},
		{
			date: date(28, 'jan', 2026),
			title: translations.bio_link_safety_blog_title,
			publisher: translations.bio_publisher_openai,
			id: '1a8b03ca-415a-4e30-bf2c-1f9969779e1a',
			description: translations.bio_link_safety_blog_description,
			url: url`https://openai.com/index/ai-agent-link-safety`,
			tags: [work, security, writing],
		},
		{
			url: url`https://openai.com/index/introducing-lockdown-mode-and-elevated-risk-labels-in-chatgpt`,
			date: date(13, 'feb', 2026),
			title: translations.bio_lockdown_mode_title,
			publisher: translations.bio_publisher_openai,
			id: '68408DCB-0B05-451B-8CED-DAD64CDE41B7',
			description: translations.bio_lockdown_mode_description,
			tags: [work, security, writing],
		},
		{
			url: url`https://openai.com/index/designing-agents-to-resist-prompt-injection/`,
			date: date(11, 'mar', 2026),
			title: translations.bio_resist_prompt_injection_title,
			publisher: translations.bio_publisher_openai,
			id: 'f26d0898-3e7f-4429-9ba6-9868f85f4367',
			description: translations.bio_resist_prompt_injection_description,
			tags: [work, security, writing],
		},
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
				lang.text(lang.resolveText(name)),
				{
					name: name,
					href,
				},
			] as const
	)
);
