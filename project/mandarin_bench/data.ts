export const BENCHMARK_ID = 'mandarin-bench-1904-jiachen-enke';

export type Source = {
	id: string;
	title: string;
	url: string;
	note: string;
};

export type ExamStage = 'metropolitan' | 'palace';

export type QuestionKind =
	| 'classics-explication'
	| 'history-argument'
	| 'palace-policy'
	| 'statecraft-policy';

export type Question = {
	id: string;
	expectedCompetencies: readonly string[];
	kind: QuestionKind;
	minChineseCharacters: number;
	order: number;
	original: string;
	sourceIds: readonly string[];
	stage: ExamStage;
	title: string;
	topicKeywords: readonly string[];
};

export type Benchmark = {
	id: string;
	description: string;
	limitations: readonly string[];
	passPercent: number;
	questions: readonly Question[];
	sources: readonly Source[];
	title: string;
};

export const SOURCES: readonly Source[] = [
	{
		id: 'npm-1904-title-register',
		title: 'National Palace Museum: 光緒三十年會試題名錄',
		url: 'https://theme.npm.edu.tw/selection/Article.aspx?sNo=04009322',
		note: 'Confirms the 1904 Jiachen Enke metropolitan and palace examination dates, the 1905 abolition, and the title-register object containing exam questions.',
	},
	{
		id: 'zhwiki-jiachen-list',
		title: '光緒三十年甲辰恩科貢士進士列表',
		url: 'https://zh.wikipedia.org/wiki/光緒三十年甲辰恩科貢士進士列表',
		note: 'Convenient text transcription of the 1904 Jiachen Enke metropolitan examination questions.',
	},
	{
		id: 'sohu-jiachen-palace',
		title: '1904甲辰恩科：中国最后的科考，最后的科举试题，最后的士子',
		url: 'https://www.sohu.com/a/357161030_99890437',
		note: 'Secondary transcription of the palace-examination edict and four policy-question clusters.',
	},
];

const sharedHistoryCompetencies = [
	'identifies the named historical precedents without flattening them into generic summaries',
	'compares institutional tradeoffs rather than only praising or condemning a dynasty',
	'uses period-appropriate statecraft vocabulary and avoids post-1904 hindsight',
] as const;

const sharedPolicyCompetencies = [
	'answers the concrete policy choice in the question',
	'connects classical precedent to late-Qing administrative constraints',
	'weighs benefits, risks, sequencing, and implementation capacity',
] as const;

export const QUESTIONS: readonly Question[] = [
	{
		id: 'metropolitan-history-centralization',
		expectedCompetencies: sharedHistoryCompetencies,
		kind: 'history-argument',
		minChineseCharacters: 900,
		order: 1,
		original: '周唐外重内轻，秦魏外轻内重，各有得失论。',
		sourceIds: ['zhwiki-jiachen-list'],
		stage: 'metropolitan',
		title: 'Dynastic Center And Periphery',
		topicKeywords: ['周', '唐', '秦', '魏', '外重内轻', '外轻内重'],
	},
	{
		id: 'metropolitan-history-frontier-policy',
		expectedCompetencies: sharedHistoryCompetencies,
		kind: 'history-argument',
		minChineseCharacters: 900,
		order: 2,
		original:
			'贾谊五饵三表之说，班固讥其疏。然秦穆尝用之以霸西戎，中行说亦以戒单于，其说未尝不效论。',
		sourceIds: ['zhwiki-jiachen-list'],
		stage: 'metropolitan',
		title: 'Jia Yi And Frontier Statecraft',
		topicKeywords: ['贾谊', '五饵', '三表', '班固', '秦穆', '中行说', '单于'],
	},
	{
		id: 'metropolitan-history-legalist-method',
		expectedCompetencies: sharedHistoryCompetencies,
		kind: 'history-argument',
		minChineseCharacters: 900,
		order: 3,
		original: '诸葛亮无申商之心而用其术，王安石用申商之实而讳其名论。',
		sourceIds: ['zhwiki-jiachen-list'],
		stage: 'metropolitan',
		title: 'Legalist Technique Without Legalist Name',
		topicKeywords: ['诸葛亮', '申商', '王安石', '术', '实'],
	},
	{
		id: 'metropolitan-history-private-counsel',
		expectedCompetencies: sharedHistoryCompetencies,
		kind: 'history-argument',
		minChineseCharacters: 900,
		order: 4,
		original: '裴度奏宰相宜招延四方贤才与参谋请于私第见客论。',
		sourceIds: ['zhwiki-jiachen-list'],
		stage: 'metropolitan',
		title: 'Pei Du And Informal Counsel',
		topicKeywords: ['裴度', '宰相', '贤才', '参谋', '私第'],
	},
	{
		id: 'metropolitan-history-foreign-alliance',
		expectedCompetencies: sharedHistoryCompetencies,
		kind: 'history-argument',
		minChineseCharacters: 900,
		order: 5,
		original: '北宋结金以图燕赵，南宋助元以攻蔡论。',
		sourceIds: ['zhwiki-jiachen-list'],
		stage: 'metropolitan',
		title: 'Song Foreign Alliances',
		topicKeywords: ['北宋', '南宋', '金', '元', '燕赵', '蔡'],
	},
	{
		id: 'metropolitan-policy-education-priority',
		expectedCompetencies: sharedPolicyCompetencies,
		kind: 'statecraft-policy',
		minChineseCharacters: 1000,
		order: 6,
		original:
			'学堂之设，其旨有三，所以陶铸国民、造就人才、振兴实业。国民不能自立，必立学以教之，使皆有善良之德、忠爱之心、自养之技能、必需之知识，盖东西各国所同，日本则尤注重尚武之精神，此陶铸国民之教育也。讲求政治、法律、理财、外交诸专门，以备任使，此造就人才之教育也。分设农、工、商、矿诸学，以期富国利民，此振兴实业之教育也。三者孰为最急策。',
		sourceIds: ['zhwiki-jiachen-list', 'npm-1904-title-register'],
		stage: 'metropolitan',
		title: 'Priority Among Educational Aims',
		topicKeywords: ['学堂', '陶铸国民', '造就人才', '振兴实业', '尚武'],
	},
	{
		id: 'metropolitan-policy-agriculture',
		expectedCompetencies: sharedPolicyCompetencies,
		kind: 'statecraft-policy',
		minChineseCharacters: 1000,
		order: 7,
		original:
			'周礼言农政最详，诸子有农家之学。近时各国研究农务，多以人事转移气候，其要曰土地、曰资本、曰劳力，而能善用此三者，实资智识。方今修明学制，列为专科，冀存要术之遗。试陈教农之策。',
		sourceIds: ['zhwiki-jiachen-list'],
		stage: 'metropolitan',
		title: 'Agricultural Education',
		topicKeywords: ['周礼', '农政', '农家', '土地', '资本', '劳力', '教农'],
	},
	{
		id: 'metropolitan-policy-western-diplomacy',
		expectedCompetencies: sharedPolicyCompetencies,
		kind: 'statecraft-policy',
		minChineseCharacters: 1000,
		order: 8,
		original:
			'泰西外交政策往往借保全土地之名，收利益之实。盍缕举近百年历史以证明其事策。',
		sourceIds: ['zhwiki-jiachen-list', 'npm-1904-title-register'],
		stage: 'metropolitan',
		title: 'Western Diplomacy And Protectorates',
		topicKeywords: ['泰西', '外交', '保全土地', '利益', '近百年'],
	},
	{
		id: 'metropolitan-policy-foreign-advisers',
		expectedCompetencies: sharedPolicyCompetencies,
		kind: 'statecraft-policy',
		minChineseCharacters: 1000,
		order: 9,
		original:
			'日本变法之初，聘用西人而国日以强；埃及用外国人至千余员，遂失财政、裁判之权而国以不振。试详言其得失利弊策。',
		sourceIds: ['zhwiki-jiachen-list', 'npm-1904-title-register'],
		stage: 'metropolitan',
		title: 'Foreign Advisers In Japan And Egypt',
		topicKeywords: ['日本', '变法', '西人', '埃及', '财政', '裁判'],
	},
	{
		id: 'metropolitan-policy-chinese-exclusion',
		expectedCompetencies: sharedPolicyCompetencies,
		kind: 'statecraft-policy',
		minChineseCharacters: 1000,
		order: 10,
		original:
			'美国禁止华工，久成苛例。今届十年期满，亟宜援引公法，驳正原约，以期保护侨民策。',
		sourceIds: ['zhwiki-jiachen-list', 'npm-1904-title-register'],
		stage: 'metropolitan',
		title: 'Chinese Exclusion And International Law',
		topicKeywords: ['美国', '华工', '公法', '原约', '侨民'],
	},
	{
		id: 'metropolitan-classics-great-learning',
		expectedCompetencies: [
			'explicates the canonical phrase with attention to moral cultivation and government',
			'connects exegesis to usable political judgment',
			'maintains a classical essay register',
		],
		kind: 'classics-explication',
		minChineseCharacters: 700,
		order: 11,
		original: '大学之道，在明明德，在亲民，在止于至善义。',
		sourceIds: ['zhwiki-jiachen-list'],
		stage: 'metropolitan',
		title: 'Great Learning: Bright Virtue',
		topicKeywords: ['大学', '明明德', '亲民', '止于至善'],
	},
	{
		id: 'metropolitan-classics-mean',
		expectedCompetencies: [
			'explains the line without reducing it to a modern slogan',
			'balances moral psychology and public conduct',
			'maintains a classical essay register',
		],
		kind: 'classics-explication',
		minChineseCharacters: 700,
		order: 12,
		original: '中立而不倚，强哉矫义。',
		sourceIds: ['zhwiki-jiachen-list'],
		stage: 'metropolitan',
		title: 'Doctrine Of The Mean: Upright Independence',
		topicKeywords: ['中立', '不倚', '强哉矫'],
	},
	{
		id: 'metropolitan-classics-exchange',
		expectedCompetencies: [
			'explicates the classical line in relation to social order and exchange',
			'connects ritual, economy, and government without anachronistic market theory',
			'maintains a classical essay register',
		],
		kind: 'classics-explication',
		minChineseCharacters: 700,
		order: 13,
		original: '致天下之民，聚天下之货，交易而退，各得其所义。',
		sourceIds: ['zhwiki-jiachen-list'],
		stage: 'metropolitan',
		title: 'Classic On Exchange And Proper Place',
		topicKeywords: ['天下之民', '天下之货', '交易', '各得其所'],
	},
	{
		id: 'palace-policy-final-edict',
		expectedCompetencies: [
			'integrates the edict themes instead of answering only one subquestion',
			'balances local administration, official education, military reform, public finance, and moral learning',
			'offers reforms plausible for a 1904 Qing court memorial',
			'uses deferential palace-examination rhetoric without empty ornament',
		],
		kind: 'palace-policy',
		minChineseCharacters: 1600,
		order: 14,
		original:
			'光绪三十年五月二十一日，策试天下贡士于保和殿。制曰：朕诞膺大宝，今三十年，仰承列圣之诒谋，恪秉慈闱之懿训，宵旰忧勤，无时不以民事艰难为念。本年恭值皇太后七旬万寿，庆榜特开，冀求时彦，集思广益，以沃朕心。尔多士其扬榷陈之：君人之道，子育为心，虽深居九重，而虑周亿兆，民间疾苦，惟守令之最真。汉以六条察二千石，而以察令之权寄之于守，此与今制用意无殊。而循良之绩，今不如古，粉饰欺蔽之习，何以杜之？世局日变，任事需才，学堂、警察、交涉、工艺诸政，皆非不学之人所能董理。将欲任以繁剧，必先扩其闻见，陶成之责在长官，顾各省设馆课吏，多属具文。上以诚求，下以伪应，宜筹良法以振策之。汉制县邑丞尉，多以本郡人为之，犹有周官遗意，其法尚可行否？三代之制，寓兵于农，自井田沟洫之法废，遂专用征兵，岂因时而变，各得其宜欤？汉高祖设轻车骑士、材官、楼船，常以秋后讲肄课试。三者各随其地之所宜，盍析言之？唐初置府兵，中叶府兵制坏，专用征兵，能详陈其得失利弊欤？宋韩琦之议养兵，苏轼之言定军制、练军实最为深切著明，能以今日情势互证之欤？兵强于学，学兴于教，环球列邦，多以尚武立国。知兵之选，遍于士夫，体育之规，基诸童稚，师人长技，可不深究其原欤？周礼太宰以九式均节财用，注云：“式谓用财之节度，职内掌邦之赋入，职岁掌邦之赋出。”此与各国之预算、决算有异同否？苏轼之策理财，谓天下之费，有去之甚易而无损，存之甚难而无益。曾巩之议经费，谓浮者必求其所以浮之自而杜之，约者必本其所以约之由而从之。皆扼要之论，能引申其旨欤？节流不外省冗费、裁冗官，施行之序，能筹其轻重缓急欤？开源之法，以农工商该之，今特设专部，悉心区画，整齐利导之方，能缕陈欤？士习之邪正，视乎教育之得失。古者司徒修明礼教，以选士、俊士、造士为任官之法。汉重明经，复设孝廉、贤良诸科，其时贾董之徒最称渊茂，东汉之士以节义相高，论者或病其清议标榜，果定评欤？唐初文学最盛，中叶而后，干进者至有求知己与温卷之名，隆替盛衰之故，试探其原。宋世名儒辈出，各有师承，至于崇廉耻、敦气节，流风所被，迄有明而未衰，果人能自树立欤？抑师道立而善人多欤？今欲使四海之内，邪慝不兴，正学日著，其何道之从？凡此皆体国之宏纲，济时之要政也。多士博览古今，通经致用，其各真言无隐，朕将亲览焉。',
		sourceIds: ['sohu-jiachen-palace', 'npm-1904-title-register'],
		stage: 'palace',
		title: 'Final Palace Examination Edict',
		topicKeywords: [
			'守令',
			'学堂',
			'警察',
			'兵制',
			'预算',
			'决算',
			'农工商',
			'士习',
			'正学',
		],
	},
];

export const MANDARIN_BENCH: Benchmark = {
	id: BENCHMARK_ID,
	description:
		'Essay benchmark built from the 1904 Guangxu 30 Jiachen Enke, the final Qing imperial examination round before the 1905 abolition of the system.',
	limitations: [
		'The historical examination ranked essays by human readers; it did not have a modern answer key.',
		'The benchmark therefore supplies candidate prompts, judge prompts, and deterministic aggregation of structured judge scores.',
		'The palace-examination edict is included as a capstone prompt from a secondary transcription; keep sourceIds with every result.',
	],
	passPercent: 70,
	questions: QUESTIONS,
	sources: SOURCES,
	title: 'MANDARIN BENCH',
};
