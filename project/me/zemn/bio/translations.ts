import * as lang from '#root/ts/react/lang/index.js';

const t = (enGB: string, zhHans: string, zhHant: string) =>
	lang.TextSelection(
		lang.Text('en-GB', enGB),
		lang.Text('zh-Hans', zhHans),
		lang.Text('zh-Hant', zhHant)
	);

export const bio_link_google_knowledge_graph = t(
	'Google Knowledge Graph',
	'Google 知识图谱',
	'Google 知識圖譜'
);
export const bio_link_cv = lang.TextSelection(
	lang.Text('en-GB', 'CV' as const),
	lang.Text('en-US', 'resume' as const),
	lang.Text('zh-Hans', '简历' as const),
	lang.Text('zh-Hant', '履歷' as const)
);
export const bio_link_linkedin = t('linkedin', '领英', 'LinkedIn');
export const bio_link_github = t('github', 'GitHub', 'GitHub');
export const bio_link_bluesky = t('bluesky', 'Bluesky', 'Bluesky');
export const bio_link_twitter = t('twitter', 'Twitter', 'Twitter');
export const bio_link_youtube = t('youtube', 'YouTube', 'YouTube');
export const bio_link_twitch = t('twitch', 'Twitch', 'Twitch');
export const bio_link_forbes = t('forbes', '福布斯', '富比士');

export const bio_tag_gaming = t('gaming', '游戏', '遊戲');
export const bio_tag_accolade = t('accolade', '奖项', '獎項');
export const bio_tag_talk = t('talk', '演讲', '演講');
export const bio_tag_software = t('software', '软件', '軟體');
export const bio_tag_react = t('react', 'React', 'React');
export const bio_tag_security = t('security', '安全', '安全');
export const bio_tag_d3 = t('d3', 'd3', 'd3');
export const bio_tag_library = t('library', '库', '函式庫');
export const bio_tag_disclosure = t('disclosure', '漏洞披露', '漏洞揭露');
export const bio_tag_comment = t('comment', '评论', '評論');
export const bio_tag_work = t('work', '工作', '工作');
export const bio_tag_writing = t('writing', '写作', '寫作');
export const bio_tag_science = t('science', '科学', '科學');
export const bio_tag_design = t('design', '设计', '設計');
export const bio_tag_code = t('code', '代码', '程式碼');
export const bio_tag_typescript = t('typescript', 'TypeScript', 'TypeScript');
export const bio_tag_nodejs = t('nodejs', 'Node.js', 'Node.js');
export const bio_tag_golang = t('golang', 'Go', 'Go');
export const bio_tag_rust = t('rust', 'Rust', 'Rust');
export const bio_tag_go = t('go', 'Go', 'Go');
export const bio_tag_employment = t('employment', '任职', '任職');

export const bio_skill_go = t('Go', 'Go', 'Go');
export const bio_skill_typescript = t('Typescript', 'TypeScript', 'TypeScript');
export const bio_skill_python = t('Python', 'Python', 'Python');
export const bio_skill_graphql = t('GraphQL', 'GraphQL', 'GraphQL');
export const bio_skill_static_analysis = t(
	'Static Analysis',
	'静态分析',
	'靜態分析'
);
export const bio_skill_javascript = t('Javascript', 'JavaScript', 'JavaScript');
export const bio_skill_react = t('React', 'React', 'React');
export const bio_skill_d3 = t('d3', 'd3', 'd3');
export const bio_skill_bash = t('Bash', 'Bash', 'Bash');
export const bio_skill_ruby = t('Ruby', 'Ruby', 'Ruby');
export const bio_skill_appsec_arch = t(
	'appsec arch',
	'应用安全架构',
	'應用安全架構'
);
export const bio_skill_electron = t('Electron', 'Electron', 'Electron');
export const bio_skill_aws = t('AWS', 'AWS', 'AWS');
export const bio_skill_pentesting = t('pentesting', '渗透测试', '滲透測試');
export const bio_skill_code_review = t('code review', '代码审查', '程式碼審查');
export const bio_skill_cryptography = t('cryptography', '密码学', '密碼學');
export const bio_skill_reverse_engineering = t(
	'reverse-engineering',
	'逆向工程',
	'逆向工程'
);
export const bio_skill_starlark = t('starlark', 'Starlark', 'Starlark');
export const bio_skill_bazel = t('bazel', 'Bazel', 'Bazel');

export const bio_role_google_title = t(
	'Senior Information Security Engineer, Google ISE hardening',
	'高级信息安全工程师，Google ISE 加固',
	'資深資訊安全工程師，Google ISE 強化'
);
export const bio_role_google_description = t(
	'Automated security mitigation, detection and refactoring using compiler technology (“langsec”), SDKs and DSLs (“hardening”) on TypeScript and Java. Google-wide mitigations for Log4Shell, XSS, deserialization attacks. Product security review and design, Google Ads (“FLOC”, “FLEDGE”), Google Cloud, Google\'s IDE (“Cider”). Research including critical disclosures such as CVE-2022-41034.',
	'使用编译器技术（“langsec”）、SDK 和 DSL（“hardening”）在 TypeScript 与 Java 上自动化安全缓解、检测和重构。参与 Google 范围内的 Log4Shell、XSS、反序列化攻击缓解；负责产品安全评审与设计，覆盖 Google Ads（“FLOC”、“FLEDGE”）、Google Cloud、Google 的 IDE（“Cider”）。研究工作包括 CVE-2022-41034 等重要披露。',
	'使用編譯器技術（「langsec」）、SDK 與 DSL（「hardening」）在 TypeScript 與 Java 上自動化安全緩解、偵測與重構。參與 Google 範圍內的 Log4Shell、XSS、反序列化攻擊緩解；負責產品安全審查與設計，涵蓋 Google Ads（「FLOC」、「FLEDGE」）、Google Cloud、Google 的 IDE（「Cider」）。研究工作包括 CVE-2022-41034 等重要揭露。'
);
export const bio_role_twitch_title = t(
	'Senior Application Security Engineer, Twitch',
	'Twitch 高级应用安全工程师',
	'Twitch 資深應用安全工程師'
);
export const bio_role_ncsc_title = t(
	'Application Security Engineer, UK National Cyber Security Centre',
	'英国国家网络安全中心应用安全工程师',
	'英國國家網路安全中心應用安全工程師'
);
export const bio_role_openai_appsec_title = t(
	'Member of Technical Staff, AppSec, OpenAI',
	'OpenAI 技术员工，应用安全',
	'OpenAI 技術員工，應用安全'
);
export const bio_role_openai_prop_title = t(
	'Member of Technical Staff, Security Product and Platform (PROP), OpenAI',
	'OpenAI 技术员工，安全产品与平台（PROP）',
	'OpenAI 技術員工，安全產品與平台（PROP）'
);

export const bio_employer_google = t('Google', 'Google', 'Google');
export const bio_employer_twitch = t('Twitch', 'Twitch', 'Twitch');
export const bio_employer_openai = t('OpenAI', 'OpenAI', 'OpenAI');
export const bio_employer_royal_free = t(
	'Royal Free Hospital NHS Trust',
	'Royal Free Hospital NHS Trust',
	'Royal Free Hospital NHS Trust'
);
export const bio_employer_the_grove = t(
	'The Grove Hotel',
	'The Grove Hotel',
	'The Grove Hotel'
);

export const bio_publisher_zemn_me = t('zemn.me', 'zemn.me', 'zemn.me');
export const bio_publisher_openai = t('OpenAI', 'OpenAI', 'OpenAI');
export const bio_publisher_forbes = t('Forbes', '福布斯', '富比士');
export const bio_publisher_defcon = t('DEF CON', 'DEF CON', 'DEF CON');
export const bio_publisher_defcon_31 = t('DEF CON 31', 'DEF CON 31', 'DEF CON 31');
export const bio_publisher_shmoocon = t('ShmooCon', 'ShmooCon', 'ShmooCon');
export const bio_publisher_hackerone = t('HackerOne', 'HackerOne', 'HackerOne');
export const bio_publisher_nvd = t('NVD', 'NVD', 'NVD');
export const bio_publisher_github_advisory_database = t(
	'GitHub Advisory Database',
	'GitHub 安全公告数据库',
	'GitHub 安全公告資料庫'
);
export const bio_publisher_github_security_advisory = t(
	'GitHub Security Advisory',
	'GitHub 安全公告',
	'GitHub 安全公告'
);
export const bio_publisher_uk_ncsc = t(
	'UK National Cyber Security Centre',
	'英国国家网络安全中心',
	'英國國家網路安全中心'
);
export const bio_publisher_valve = t(
	'Valve Corporation',
	'Valve 公司',
	'Valve 公司'
);
export const bio_publisher_university_cambridge = t(
	'University of Cambridge',
	'剑桥大学',
	'劍橋大學'
);
export const bio_publisher_real_world_ai_security = t(
	'Real World AI Security',
	'Real World AI Security',
	'Real World AI Security'
);
export const bio_publisher_defcon_singapore = t(
	'DEF CON Singapore',
	'DEF CON 新加坡',
	'DEF CON 新加坡'
);
export const bio_publisher_ai_agent_security_summit_sf = t(
	'AI Agent Security Summit SF',
	'旧金山 AI Agent Security Summit',
	'舊金山 AI Agent Security Summit'
);
export const bio_publisher_vtube_studio = t(
	'VTube Studio',
	'VTube Studio',
	'VTube Studio'
);
export const bio_publisher_bbc_news = t('BBC News', 'BBC 新闻', 'BBC 新聞');
export const bio_publisher_msrc = t('MSRC', 'MSRC', 'MSRC');
export const bio_publisher_threatpost = t(
	'Threatpost',
	'Threatpost',
	'Threatpost'
);
export const bio_publisher_infiltrate = t(
	'Infiltrate',
	'Infiltrate',
	'Infiltrate'
);
export const bio_publisher_packet_storm = t(
	'Packet Storm',
	'Packet Storm',
	'Packet Storm'
);
export const bio_publisher_owasp = t('OWASP', 'OWASP', 'OWASP');
export const bio_publisher_infoq = t('InfoQ', 'InfoQ', 'InfoQ');
export const bio_publisher_young_rewired_state = t(
	'Young Rewired State',
	'Young Rewired State',
	'Young Rewired State'
);
export const bio_publisher_de_nieuwe_reporter = t(
	'De Nieuwe Reporter',
	'De Nieuwe Reporter',
	'De Nieuwe Reporter'
);
export const bio_publisher_game_dev_days = t(
	'Game Dev Days',
	'Game Dev Days',
	'Game Dev Days'
);

export const bio_talk_stanford_prompt_injection_description = t(
	'Talk at Stanford with Adrian Spânu on the present and future of prompt injection.',
	'在斯坦福与 Adrian Spânu 共同演讲，讨论提示注入的现状与未来。',
	'在史丹佛與 Adrian Spânu 共同演講，討論提示注入的現況與未來。'
);
export const bio_talk_real_world_agentic_ai_title = t(
	'Beyond Prompt Injection: Agentic AI Attacks in the Real World',
	'超越提示注入：现实世界中的 Agentic AI 攻击',
	'超越提示注入：現實世界中的 Agentic AI 攻擊'
);
export const bio_talk_defcon_singapore_prompt_injection_description = t(
	'Talk with Adrian Spânu on the present and future of prompt injection. One of the most attended talks at the conference. Q&A lasted for 2 hours.',
	'与 Adrian Spânu 共同演讲，讨论提示注入的现状与未来。这是大会听众最多的演讲之一，问答持续了 2 小时。',
	'與 Adrian Spânu 共同演講，討論提示注入的現況與未來。這是大會聽眾最多的演講之一，問答持續了 2 小時。'
);
export const bio_article_mandarin_bench_title = t(
	'Mandarin Bench',
	'Mandarin Bench',
	'華文衡鑑'
);
export const bio_article_mandarin_bench_description = t(
	'Benchmarking language models against the last Qing imperial examination.',
	'用最后一届清代科举考试对语言模型进行基准测试。',
	'用最後一屆清代科舉考試對語言模型進行基準測試。'
);
export const bio_article_kasimir_title = t(
	'Letter to Kasimir',
	'给 Kasimir 的信',
	'給 Kasimir 的信'
);
export const bio_article_kasimir_description = t(
	'A letter to Kasimir, a child of a friend, about the world and how to understand it.',
	'写给朋友孩子 Kasimir 的一封信，谈世界以及如何理解它。',
	'寫給朋友孩子 Kasimir 的一封信，談世界以及如何理解它。'
);
export const bio_article_missing_title = t('Missing', '想念', '想念');
export const bio_article_missing_description = t(
	'Article on what it means to miss home after two years.',
	'关于离家两年后“想家”意味着什么的文章。',
	'關於離家兩年後「想家」意味著什麼的文章。'
);
export const bio_article_clean_title = t(
	'The Hagiography of Clean',
	'洁净的圣徒传',
	'潔淨的聖徒傳'
);
export const bio_article_clean_description = t(
	'Article analysing cleanliness, the human condition, and social media.',
	'分析洁净、人类处境和社交媒体的文章。',
	'分析潔淨、人類處境和社群媒體的文章。'
);
export const bio_article_csp_title = t(
	'When Security Generates Insecurity',
	'当安全制造不安全',
	'當安全製造不安全'
);
export const bio_mozfest_title = t(
	'MozFest: Rewired State gives young programmers a chance',
	'MozFest：Rewired State 给年轻程序员一个机会',
	'MozFest：Rewired State 給年輕程式設計師一個機會'
);
export const bio_vscode_rce_description = t(
	'Google research; exploit to remotely take over VSCode and any attached cloud systems. CVE-2022-41034, GHSA-pw56-c55x-cm9m',
	'Google 研究；可远程接管 VSCode 及其连接的云系统的漏洞利用。CVE-2022-41034，GHSA-pw56-c55x-cm9m',
	'Google 研究；可遠端接管 VSCode 及其連接的雲端系統的漏洞利用。CVE-2022-41034，GHSA-pw56-c55x-cm9m'
);
export const bio_vscode_rce_title = t(
	'Visual Studio Code: Remote Code Execution',
	'Visual Studio Code：远程代码执行',
	'Visual Studio Code：遠端程式碼執行'
);
export const bio_reactive_d3_description = t(
	'react helper bindings for d3',
	'd3 的 React 辅助绑定',
	'd3 的 React 輔助綁定'
);
export const bio_reactive_d3_title = t('reactive-d3', 'reactive-d3', 'reactive-d3');
export const bio_design_evolves_description = t(
	'musings on the evolution of design',
	'关于设计如何演化的思考',
	'關於設計如何演化的思考'
);
export const bio_design_evolves_title = t(
	'Design Evolves By Constraint',
	'设计因约束而演化',
	'設計因約束而演化'
);
export const bio_rnoms_description = t(
	'minimal reactive d3.js resistor colour code calculator',
	'极简 reactive d3.js 电阻色码计算器',
	'極簡 reactive d3.js 電阻色碼計算器'
);
export const bio_rnoms_title = t('r.no.ms', 'r.no.ms', 'r.no.ms');
export const bio_geckoboard_description = t(
	'London Real Time Hackathon',
	'London Real Time Hackathon',
	'London Real Time Hackathon'
);
export const bio_geckoboard_title = t(
	'Geckoboard Prize',
	'Geckoboard 奖',
	'Geckoboard 獎'
);
export const bio_svgshot_title = t('SVGShot', 'SVGShot', 'SVGShot');
export const bio_svgshot_description = t(
	"small tool for taking SVG 'screenshots' of webpages",
	'用于给网页生成 SVG“截图”的小工具',
	'用於替網頁產生 SVG「截圖」的小工具'
);
export const bio_tf2outpost_description = t(
	'Volunteer role at once largest trading website in the Steam community. Worked on administration of high-profile trades & scams',
	'在曾经最大的 Steam 社区交易网站担任志愿者，负责管理高价值交易和诈骗案件。',
	'在曾經最大的 Steam 社群交易網站擔任志願者，負責管理高價值交易和詐騙案件。'
);
export const bio_tf2outpost_title = t(
	'Sr. Admin, TF2Outpost',
	'TF2Outpost 高级管理员',
	'TF2Outpost 資深管理員'
);
export const bio_rewired_state_parliament_description = t(
	'Rewired State: Parliament',
	'Rewired State：议会',
	'Rewired State：議會'
);
export const bio_parliament_prize_title = t(
	'Better understanding of the work of Parliament Prize',
	'更好理解议会工作奖',
	'更好理解議會工作獎'
);
export const bio_young_rewired_state_description = t(
	'Prize from national hackathon for young people.',
	'全国青少年黑客松奖项。',
	'全國青少年黑客松獎項。'
);
export const bio_best_example_coding_title = t(
	'Best example of Coding',
	'最佳编程示例',
	'最佳程式設計示例'
);
export const bio_hackfortress_champions_title = t(
	'HackFortress Champions',
	'HackFortress 冠军',
	'HackFortress 冠軍'
);
export const bio_hackfortress_defended_description = t(
	'Defended title for hybrid gaming CTF / esports competition.',
	'在混合游戏 CTF / 电竞比赛中卫冕。',
	'在混合遊戲 CTF / 電競比賽中衛冕。'
);
export const bio_cors_header_title = t(
	'If CORS is just a header, why don’t attackers just ignore it?',
	'如果 CORS 只是一个 header，攻击者为什么不直接忽略它？',
	'如果 CORS 只是一個 header，攻擊者為什麼不直接忽略它？'
);
export const bio_cors_header_description = t(
	'Article on common security misconceptions around CORS.',
	'关于 CORS 常见安全误解的文章。',
	'關於 CORS 常見安全誤解的文章。'
);
export const bio_consultant_description = t(
	'Full stack freelance work building MVPs for London startups and wrangling data for hackathons.',
	'为伦敦初创公司自由职业开发 MVP，并为黑客松整理数据。',
	'為倫敦新創公司自由職業開發 MVP，並為黑客松整理資料。'
);
export const bio_consultant_title = t(
	'Software Engineer, Consultant',
	'软件工程师，顾问',
	'軟體工程師，顧問'
);
export const bio_prompt_injections_title = t(
	'Understanding prompt injections: a frontier security challenge',
	'理解提示注入：前沿安全挑战',
	'理解提示注入：前沿安全挑戰'
);
export const bio_prompt_injections_description = t(
	'Overview of OpenAI’s approach to prompt injection',
	'OpenAI 应对提示注入方法的概述',
	'OpenAI 應對提示注入方法的概述'
);
export const bio_gpt4o_title = t('GPT4o', 'GPT-4o', 'GPT-4o');
export const bio_gpt4o_description = t(
	'Product security for OpenAI’s first multimodal model.',
	'负责 OpenAI 首个多模态模型的产品安全。',
	'負責 OpenAI 首個多模態模型的產品安全。'
);
export const bio_chatgpt_canvas_title = t(
	'ChatGPT Canvas',
	'ChatGPT Canvas',
	'ChatGPT Canvas'
);
export const bio_chatgpt_canvas_description = t(
	'Security for AI pairing system for text.',
	'负责文本 AI 协作系统的安全。',
	'負責文字 AI 協作系統的安全。'
);
export const bio_gpt5_title = t('GPT5', 'GPT-5', 'GPT-5');
export const bio_gpt5_description = t(
	"Security for OpenAI's next-generation model.",
	'负责 OpenAI 下一代模型的安全。',
	'負責 OpenAI 下一代模型的安全。'
);
export const bio_agent_security_panel_title = t(
	'Panel Discussion: How Leading AI Platforms Approach Building Trustworthy Agents',
	'圆桌讨论：领先 AI 平台如何构建可信 Agent',
	'圓桌討論：領先 AI 平台如何建構可信 Agent'
);
export const bio_agent_security_panel_description = t(
	'Panel representing OpenAI at the AI Agent Security summit at the Commonwealth Club of San Francisco.',
	'在旧金山 Commonwealth Club 的 AI Agent Security Summit 上代表 OpenAI 参加圆桌讨论。',
	'在舊金山 Commonwealth Club 的 AI Agent Security Summit 上代表 OpenAI 參加圓桌討論。'
);
export const bio_chatgpt_atlas_title = t(
	'ChatGPT Atlas',
	'ChatGPT Atlas',
	'ChatGPT Atlas'
);
export const bio_chatgpt_atlas_description = t(
	'AI enabled web-browser.',
	'支持 AI 的网页浏览器。',
	'支援 AI 的網頁瀏覽器。'
);
export const bio_url_exfil_paper_title = t(
	'Preventing URL-Based Data Exfiltration in Language-Model Agents',
	'防止语言模型 Agent 通过 URL 泄露数据',
	'防止語言模型 Agent 透過 URL 外洩資料'
);
export const bio_url_exfil_paper_description = t(
	'Paper describing the mechanism OpenAI products such as ChatGPT use to detect when an AI is communicating non-public data.',
	'论文介绍 ChatGPT 等 OpenAI 产品用于检测 AI 是否正在传输非公开数据的机制。',
	'論文介紹 ChatGPT 等 OpenAI 產品用於偵測 AI 是否正在傳輸非公開資料的機制。'
);
export const bio_link_safety_blog_title = t(
	'Keeping your data safe when an AI agent clicks a link',
	'当 AI Agent 点击链接时保护你的数据',
	'當 AI Agent 點擊連結時保護你的資料'
);
export const bio_link_safety_blog_description = t(
	'Blog post summarising paper describing the mechanism OpenAI products such as ChatGPT use to detect when an AI is communicating non-public data.',
	'博客文章，概述一篇关于 ChatGPT 等 OpenAI 产品如何检测 AI 是否正在传输非公开数据的论文。',
	'部落格文章，概述一篇關於 ChatGPT 等 OpenAI 產品如何偵測 AI 是否正在傳輸非公開資料的論文。'
);
export const bio_lockdown_mode_title = t(
	'Introducing Lockdown Mode and Elevated Risk labels in ChatGPT',
	'介绍 ChatGPT 的 Lockdown Mode 与 Elevated Risk 标签',
	'介紹 ChatGPT 的 Lockdown Mode 與 Elevated Risk 標籤'
);
export const bio_lockdown_mode_description = t(
	'Blog post summarising a fully sandboxed mode for chatgpt which mitigates impacts from Prompt Injection.',
	'博客文章，概述 ChatGPT 中用于缓解提示注入影响的完全沙盒模式。',
	'部落格文章，概述 ChatGPT 中用於緩解提示注入影響的完全沙盒模式。'
);
export const bio_resist_prompt_injection_title = t(
	'Designing AI agents to resist prompt injection',
	'设计能够抵御提示注入的 AI Agent',
	'設計能夠抵禦提示注入的 AI Agent'
);
export const bio_resist_prompt_injection_description = t(
	'Blog post on how prompt injection attacks are becoming more like social engineering and how we can design AI agents to be more resistant to them.',
	'博客文章，讨论提示注入攻击如何越来越像社会工程，以及如何设计更能抵御这类攻击的 AI Agent。',
	'部落格文章，討論提示注入攻擊如何越來越像社交工程，以及如何設計更能抵禦這類攻擊的 AI Agent。'
);
export const bio_openai_appsec_description = t(
	"Built out OpenAI's first Secure Development Lifecycle (SDLC); security for OAI products including ChatGPT Canvas (ChatGPT Apps, MCP Apps & Code Blocks), OpenAI Atlas, ChatGPT Lockdown Mode, Sign In With ChatGPT, ChatGPT Finance, GPT-4o, GPT5, Apple Intelligence and others. Work on Prompt Injection, Agentic Security & AI cyber risk.",
	'建立 OpenAI 首个安全开发生命周期（SDLC）；负责 OpenAI 产品安全，包括 ChatGPT Canvas（ChatGPT Apps、MCP Apps 和 Code Blocks）、OpenAI Atlas、ChatGPT Lockdown Mode、Sign In With ChatGPT、ChatGPT Finance、GPT-4o、GPT-5、Apple Intelligence 等。工作方向包括提示注入、Agentic Security 与 AI 网络风险。',
	'建立 OpenAI 首個安全開發生命週期（SDLC）；負責 OpenAI 產品安全，包括 ChatGPT Canvas（ChatGPT Apps、MCP Apps 和 Code Blocks）、OpenAI Atlas、ChatGPT Lockdown Mode、Sign In With ChatGPT、ChatGPT Finance、GPT-4o、GPT-5、Apple Intelligence 等。工作方向包括提示注入、Agentic Security 與 AI 網路風險。'
);

export const bio_linear_title = t('linear', 'linear', 'linear');
export const bio_linear_description = t(
	'react based personal website for 2019',
	'基于 React 的 2019 版个人网站',
	'基於 React 的 2019 版個人網站'
);
export const bio_typescript_union_merging_title = t(
	'Typescript Union Merging',
	'TypeScript 联合类型合并',
	'TypeScript 聯合型別合併'
);
export const bio_typescript_union_merging_description = t(
	'Using interface merging to write somewhat decentralised Redux actions',
	'使用接口合并来编写较为去中心化的 Redux actions',
	'使用介面合併來編寫較為去中心化的 Redux actions'
);
export const bio_csvpretty_title = t('CSVPretty', 'CSVPretty', 'CSVPretty');
export const bio_csvpretty_description = t(
	'typescript pretty printer for the CSV format',
	'用于 CSV 格式的 TypeScript pretty printer',
	'用於 CSV 格式的 TypeScript pretty printer'
);
export const bio_mozfest_interview_description = t(
	'Interview on National Hack the Government Day prize (dutch)',
	'关于 National Hack the Government Day 奖项的采访（荷兰语）',
	'關於 National Hack the Government Day 獎項的訪談（荷蘭語）'
);
export const bio_national_hack_government_description = t(
	'National Hack the Government Day 2011',
	'2011 年 National Hack the Government Day',
	'2011 年 National Hack the Government Day'
);
export const bio_wallace_gromit_prize_title = t(
	'Wallace and Gromit Prize',
	'Wallace and Gromit 奖',
	'Wallace and Gromit 獎'
);
export const bio_do_sync_title = t('do-sync', 'do-sync', 'do-sync');
export const bio_do_sync_description = t(
	'Async to sync library for encapsulated javascript macros',
	'用于封装 JavaScript 宏的异步转同步库',
	'用於封裝 JavaScript 巨集的非同步轉同步函式庫'
);
export const bio_react_oauth2_hook_title = t(
	'react-oauth2-hook',
	'react-oauth2-hook',
	'react-oauth2-hook'
);
export const bio_react_oauth2_hook_description = t(
	'An entirely clientside implementation of an oauth2 implicit client, with React hooks',
	'一个完全客户端实现的 OAuth2 implicit client，使用 React hooks',
	'一個完全用戶端實作的 OAuth2 implicit client，使用 React hooks'
);
export const bio_neon_genesis_ui_title = t(
	"Why We don't we have UIs like the ones in Neon Genesis",
	'为什么我们没有《新世纪福音战士》那样的 UI',
	'為什麼我們沒有《新世紀福音戰士》那樣的 UI'
);
export const bio_neon_genesis_ui_description = t(
	'Exploration of how rendering hardware has affected UI design',
	'探索渲染硬件如何影响 UI 设计',
	'探索算圖硬體如何影響 UI 設計'
);
export const bio_go_sharper_edges_title = t(
	"This Will Cut You: Go's Sharper Edges",
	'这会割伤你：Go 更锋利的边缘',
	'這會割傷你：Go 更鋒利的邊緣'
);
export const bio_go_sharper_edges_description = t(
	'Musings on Go-specific security gotchas.',
	'关于 Go 特有安全陷阱的思考。',
	'關於 Go 特有安全陷阱的思考。'
);
export const bio_rewired_state_developer_title = t(
	'Developer, Rewired State',
	'Rewired State 开发者',
	'Rewired State 開發者'
);
export const bio_rewired_state_developer_description = t(
	'Charity focused on teaching code literacy. Ran and participated in hackathons for good causes. Taught software engineering to young people.',
	'专注于代码素养教育的慈善机构。组织并参加公益黑客松，向年轻人教授软件工程。',
	'專注於程式素養教育的慈善機構。組織並參加公益黑客松，向年輕人教授軟體工程。'
);
export const bio_tax_system_talk_title = t(
	'how to hack the uk tax system: the talk',
	'如何攻击英国税务系统：演讲',
	'如何攻擊英國稅務系統：演講'
);
export const bio_tax_system_talk_description = t(
	'Talk at OWASP about critical UK tax system flaw in obfuscated system and the 57 day trek to get it fixed.',
	'在 OWASP 演讲，介绍英国税务系统混淆代码中的严重漏洞，以及推动修复所经历的 57 天。',
	'在 OWASP 演講，介紹英國稅務系統混淆程式碼中的嚴重漏洞，以及推動修復所經歷的 57 天。'
);
export const bio_buffalo_nas_title = t(
	'Buffalo NAS Remote Shutdown',
	'Buffalo NAS 远程关机',
	'Buffalo NAS 遠端關機'
);
export const bio_buffalo_nas_description = t(
	'Unauthorized remote shutdown of Buffalo-made network attached storage devices.',
	'未经授权远程关闭 Buffalo 生产的网络附加存储设备。',
	'未經授權遠端關閉 Buffalo 生產的網路附加儲存裝置。'
);
export const bio_tf2_sunbeams_title = t(
	'Sunbeams Ebenezer',
	'Sunbeams Ebenezer',
	'Sunbeams Ebenezer'
);
export const bio_tf2_account_takeover_description = t(
	'Unique developer granted cosmetic item for the video game Team Fortress 2 granted for security issues allowing movement millions of dollars of virtual items between arbitrary accounts via account takeover.',
	'Team Fortress 2 授予开发者的唯一饰品，原因是披露了可通过账号接管在任意账号间转移数百万美元虚拟物品的安全问题。',
	'Team Fortress 2 授予開發者的唯一飾品，原因是揭露了可透過帳號接管在任意帳號間轉移數百萬美元虛擬物品的安全問題。'
);
export const bio_tf2_finders_fee_title = t(
	'Finder’s Fee',
	'Finder’s Fee',
	'Finder’s Fee'
);
export const bio_tf2_steam_decryption_description = t(
	'Unique developer granted cosmetic item for the video game Team Fortress 2 granted for security issue allowing decryption of all Steam traffic.',
	'Team Fortress 2 授予开发者的唯一饰品，原因是披露了可解密全部 Steam 流量的安全问题。',
	'Team Fortress 2 授予開發者的唯一飾品，原因是揭露了可解密全部 Steam 流量的安全問題。'
);
export const bio_hackfortress_winners_description = t(
	'Hybrid CTF / esports competition winners.',
	'混合 CTF / 电竞比赛冠军。',
	'混合 CTF / 電競比賽冠軍。'
);
export const bio_ubersicht_spotify_title = t(
	'Übersicht Remote Code Execution, Spotify takeover',
	'Übersicht 远程代码执行，Spotify 接管',
	'Übersicht 遠端程式碼執行，Spotify 接管'
);
export const bio_ubersicht_spotify_description = t(
	"Article on an Übersicht form-post bug that let any website control users’ computers, and using Spotify's certificate design to explain why localhost web services are a weak application-security boundary.",
	'文章介绍 Übersicht 的 form-post 漏洞：任意网站可借此控制用户电脑；并用 Spotify 的证书设计解释为什么 localhost Web 服务是脆弱的应用安全边界。',
	'文章介紹 Übersicht 的 form-post 漏洞：任意網站可藉此控制使用者電腦；並用 Spotify 的憑證設計解釋為什麼 localhost Web 服務是脆弱的應用安全邊界。'
);
export const bio_tf2_remote_access_item_description = t(
	'Unique developer granted cosmetic item for the video game Team Fortress 2 granted for security issue disclosures allowing remote access to computers running the video game.',
	'Team Fortress 2 授予开发者的唯一饰品，原因是披露了可远程访问运行该游戏电脑的安全问题。',
	'Team Fortress 2 授予開發者的唯一飾品，原因是揭露了可遠端存取執行該遊戲電腦的安全問題。'
);
export const bio_mr_robot_forbes_title = t(
	'Irony Alert: Hacker Finds Vulnerability In Mr Robot Website',
	'讽刺警报：黑客发现《Mr. Robot》网站漏洞',
	'諷刺警報：駭客發現《Mr. Robot》網站漏洞'
);
export const bio_mr_robot_code_execution_description = t(
	'Code execution vulnerability in website for TV show “Mr. Robot”.',
	'电视剧《Mr. Robot》网站中的代码执行漏洞。',
	'電視劇《Mr. Robot》網站中的程式碼執行漏洞。'
);
export const bio_cve_2016_2049_title = t(
	'CVE-2016-2049',
	'CVE-2016-2049',
	'CVE-2016-2049'
);
export const bio_php_openid_description = t(
	'Vulnerability in php-openid allowing an attacker to log in as any user.',
	'php-openid 漏洞，可让攻击者以任意用户身份登录。',
	'php-openid 漏洞，可讓攻擊者以任意使用者身分登入。'
);
export const bio_mr_robot_usa_title = t(
	"'Mr. Robot' Web Weaknesses Left Fans And USA Network Vulnerable, Warns Non-Fictional Hacker",
	'真实黑客警告：《Mr. Robot》网站漏洞让粉丝和 USA Network 暴露在风险中',
	'真實駭客警告：《Mr. Robot》網站漏洞讓粉絲和 USA Network 暴露在風險中'
);
export const bio_mr_robot_rce_description = t(
	'Remote code execution in website for TV show “Mr. Robot” allowing attacker to control the website server.',
	'电视剧《Mr. Robot》网站中的远程代码执行漏洞，可让攻击者控制网站服务器。',
	'電視劇《Mr. Robot》網站中的遠端程式碼執行漏洞，可讓攻擊者控制網站伺服器。'
);
export const bio_cambridge_chemistry_7th_title = t(
	'7th place Cambridge Chemistry Challenge (C₃L₆)',
	'剑桥化学挑战赛（C₃L₆）第 7 名',
	'劍橋化學挑戰賽（C₃L₆）第 7 名'
);
export const bio_cambridge_chemistry_5th_title = t(
	'5th place, Cambridge Chemistry Challenge (C₃L₆)',
	'剑桥化学挑战赛（C₃L₆）第 5 名',
	'劍橋化學挑戰賽（C₃L₆）第 5 名'
);
export const bio_game_dev_days_title = t(
	'I hacked video games like 300 times and all I got was this stupid talk',
	'我黑了电子游戏大概 300 次，结果只得到这个愚蠢演讲',
	'我黑了電子遊戲大概 300 次，結果只得到這個愚蠢演講'
);
export const bio_game_dev_days_description = t(
	'Talk at Game Dev Days 2018 in Graz, Austria summarising some security concepts for game developers.',
	'在奥地利格拉茨 Game Dev Days 2018 的演讲，为游戏开发者总结一些安全概念。',
	'在奧地利格拉茨 Game Dev Days 2018 的演講，為遊戲開發者總結一些安全概念。'
);
export const bio_csp_info_leak_title = t(
	'Cross-site information assertion leak via Content Security Policy',
	'通过内容安全策略发生的跨站信息断言泄漏',
	'透過內容安全政策發生的跨站資訊斷言外洩'
);
export const bio_csp_info_leak_description = t(
	'CSP1 information leak allowing efficient deanonymisation of internet users.',
	'CSP1 信息泄漏，可高效去匿名化互联网用户。',
	'CSP1 資訊外洩，可高效去匿名化網際網路使用者。'
);
export const bio_csp_article_description = t(
	'Exploit using Content Security Policy 1 to steal data on the web.',
	'利用 Content Security Policy 1 在 Web 上窃取数据的漏洞利用。',
	'利用 Content Security Policy 1 在 Web 上竊取資料的漏洞利用。'
);
export const bio_steam_padding_oracle_title = t(
	'Steam Patches Broken Crypto in Wake of Replay, Padding Oracle Attacks',
	'Steam 在重放与 Padding Oracle 攻击后修补损坏的加密',
	'Steam 在重放與 Padding Oracle 攻擊後修補損壞的加密'
);
export const bio_steam_padding_oracle_description = t(
	'Padding oracle based attack allowing full decryption of traffic on Steam, the world’s largest gaming platform.',
	'基于 padding oracle 的攻击，可完全解密世界最大游戏平台 Steam 的流量。',
	'基於 padding oracle 的攻擊，可完全解密世界最大遊戲平台 Steam 的流量。'
);
export const bio_steam_rce_title = t(
	'Steam Remote Code Execution',
	'Steam 远程代码执行',
	'Steam 遠端程式碼執行'
);
export const bio_steam_rce_description = t(
	"Vulnerability to remotely access Steam users' computers.",
	'可远程访问 Steam 用户电脑的漏洞。',
	'可遠端存取 Steam 使用者電腦的漏洞。'
);
export const bio_steam_chat_xss_title = t(
	'XSS in Steam React Chat Client',
	'Steam React 聊天客户端中的 XSS',
	'Steam React 聊天用戶端中的 XSS'
);
export const bio_steam_chat_xss_description = t(
	'Technical writeup & disclosure of a 1-click attack on the Steam, the world’s largest gaming platform, allowing remote access to users’ computers.',
	'技术分析与披露：针对世界最大游戏平台 Steam 的一键攻击，可远程访问用户电脑。',
	'技術分析與揭露：針對世界最大遊戲平台 Steam 的一鍵攻擊，可遠端存取使用者電腦。'
);
export const bio_steam_forbes_title = t(
	"$7,500 Steam Weakness Let Hackers Take Remote Control Of Gamers' PCs",
	'7500 美元 Steam 漏洞可让黑客远程控制玩家电脑',
	'7500 美元 Steam 漏洞可讓駭客遠端控制玩家電腦'
);
export const bio_steam_forbes_description = t(
	'News coverage of Steam vulnerability allowing remote access to users’ computers.',
	'关于可远程访问用户电脑的 Steam 漏洞的新闻报道。',
	'關於可遠端存取使用者電腦的 Steam 漏洞的新聞報導。'
);
export const bio_full_steam_ahead_title = t(
	'Full Steam Ahead: Remotely Executing Code in Modern Desktop Applications',
	'Full Steam Ahead：在现代桌面应用中远程执行代码',
	'Full Steam Ahead：在現代桌面應用中遠端執行程式碼'
);
export const bio_full_steam_ahead_description = t(
	'Technical talk at offensive AppSec conference summarising through example research into hybrid web / desktop application security',
	'在进攻性 AppSec 会议上的技术演讲，通过实例研究总结混合 Web / 桌面应用安全。',
	'在進攻性 AppSec 會議上的技術演講，透過實例研究總結混合 Web / 桌面應用安全。'
);
export const bio_bbc_tax_title = t(
	"'Serious' security flaws found on official UK tax site",
	'英国官方税务网站发现“严重”安全漏洞',
	'英國官方稅務網站發現「嚴重」安全漏洞'
);
export const bio_bbc_tax_description = t(
	'News post on manipulation of UK tax data.',
	'关于操纵英国税务数据的新闻报道。',
	'關於操縱英國稅務資料的新聞報導。'
);
export const bio_uk_vdp_title = t(
	'UK Government Vulnerability Disclosure Initiative',
	'英国政府漏洞披露计划',
	'英國政府漏洞揭露計畫'
);
export const bio_uk_vdp_description = t(
	'responsible disclosure program created with the UK National Cyber Security Center covering all government assets',
	'与英国国家网络安全中心共同创建的负责任披露计划，覆盖所有政府资产',
	'與英國國家網路安全中心共同建立的負責任揭露計畫，涵蓋所有政府資產'
);
export const bio_ncsc_description = t(
	"advisory position. Provided expertise to UK cyber advisory / defence group on Go and building security analysis systems. Launched world's first government-wide responsible disclosure program.",
	'顾问职位。为英国网络咨询 / 防御团队提供 Go 和安全分析系统建设方面的专业知识。推出世界首个政府范围的负责任披露计划。',
	'顧問職位。為英國網路諮詢 / 防禦團隊提供 Go 和安全分析系統建設方面的專業知識。推出世界首個政府範圍的負責任揭露計畫。'
);
export const bio_forbes_30_under_30_title = t(
	'30 under 30, tech',
	'30 Under 30，科技',
	'30 Under 30，科技'
);
export const bio_forbes_30_under_30_description = t(
	'For my work at Twitch, and on responsible disclosure.',
	'因我在 Twitch 的工作以及负责任披露方面的工作获选。',
	'因我在 Twitch 的工作以及負責任揭露方面的工作獲選。'
);
export const bio_tax_system_article_title = t(
	'how to hack the uk tax system, i guess',
	'大概是如何攻击英国税务系统',
	'大概是如何攻擊英國稅務系統'
);
export const bio_tax_system_article_description = t(
	'Vulnerability allowing manipulation of UK tax system.',
	'可操纵英国税务系统的漏洞。',
	'可操縱英國稅務系統的漏洞。'
);
export const bio_ncsc_turing_coin_title = t(
	"National Cyber Security Centre 'Turing' challenge coin",
	'英国国家网络安全中心“Turing”挑战币',
	'英國國家網路安全中心「Turing」挑戰幣'
);
export const bio_ncsc_turing_coin_description = t(
	'Award for my work on UK government vulnerability disclosure policy and my responsible disclosure of vulnerabilities in the UK tax system.',
	'因我在英国政府漏洞披露政策上的工作，以及对英国税务系统漏洞的负责任披露而获得的奖项。',
	'因我在英國政府漏洞揭露政策上的工作，以及對英國稅務系統漏洞的負責任揭露而獲得的獎項。'
);
export const bio_twitch_description = t(
	"first security engineer at the video game streaming website. Designed security architecture for flagship projects including bits, the Twitch API, extensions and Twitch's OIDC / OAuth AuthN/Z systems. Created and defined security relationships and processes. Built Go security static analysis system, security frameworks and libraries",
	'该电子游戏直播网站的首位安全工程师。为 Bits、Twitch API、Extensions 以及 Twitch 的 OIDC / OAuth 认证授权系统等旗舰项目设计安全架构。创建并定义安全关系和流程。构建 Go 安全静态分析系统、安全框架和库。',
	'該電子遊戲直播網站的首位安全工程師。為 Bits、Twitch API、Extensions 以及 Twitch 的 OIDC / OAuth 認證授權系統等旗艦專案設計安全架構。建立並定義安全關係和流程。建置 Go 安全靜態分析系統、安全框架和函式庫。'
);
export const bio_apple_id_title = t(
	'How to Hack Apple ID',
	'如何攻击 Apple ID',
	'如何攻擊 Apple ID'
);
export const bio_apple_id_description = t(
	'Bypassing cutting-edge web security techniques to hack Apple ID.',
	'绕过前沿 Web 安全技术来攻击 Apple ID。',
	'繞過前沿 Web 安全技術來攻擊 Apple ID。'
);
export const bio_black_badge_title = t('Black Badge', 'Black Badge', 'Black Badge');
export const bio_black_badge_description = t(
	"The highest award given by the world's largest hacker convention. Awarded for the HackFortress CTF.",
	'世界最大黑客大会颁发的最高奖项。因 HackFortress CTF 获奖。',
	'世界最大駭客大會頒發的最高獎項。因 HackFortress CTF 獲獎。'
);
export const bio_monorepo_title = t('Monorepo', 'Monorepo', 'Monorepo');
export const bio_monorepo_description = t(
	'a polyglot, fully tested, automatically upgraded, automatically versioned, continuously integrated monorepo ecosystem reflecting ideas I had working on hardening at scale at Google.',
	'一个多语言、全面测试、自动升级、自动版本化、持续集成的 monorepo 生态系统，反映了我在 Google 做大规模加固时形成的一些想法。',
	'一個多語言、全面測試、自動升級、自動版本化、持續整合的 monorepo 生態系統，反映了我在 Google 做大規模強化時形成的一些想法。'
);
export const bio_vtube_login_csrf_title = t(
	'Login CSRF, VTubeStudio',
	'VTubeStudio 登录 CSRF',
	'VTubeStudio 登入 CSRF'
);
export const bio_vtube_login_csrf_description = t(
	'fun little bug to hijack popular streaming application VTubeStudio',
	'一个可劫持热门直播应用 VTubeStudio 的有趣小漏洞',
	'一個可劫持熱門直播應用 VTubeStudio 的有趣小漏洞'
);
export const bio_vscode_workspace_trust_title = t(
	'Visual Studio Code is why I have (Workspace) Trust issues',
	'Visual Studio Code 是我有（Workspace）信任问题的原因',
	'Visual Studio Code 是我有（Workspace）信任問題的原因'
);
export const bio_vscode_workspace_trust_description = t(
	'Talk at DEF CON by Sonar R&D including original research into VSCode security, reflecting on my own prior art CVE-2022-41034 (not my talk).',
	'Sonar R&D 在 DEF CON 的演讲，包含对 VSCode 安全的原创研究，并回顾了我此前的 CVE-2022-41034 工作（不是我的演讲）。',
	'Sonar R&D 在 DEF CON 的演講，包含對 VSCode 安全的原創研究，並回顧了我此前的 CVE-2022-41034 工作（不是我的演講）。'
);
export const bio_relocated_sf_title = t(
	'Relocated to San Francisco from London.',
	'从伦敦搬到旧金山。',
	'從倫敦搬到舊金山。'
);
export const bio_ie11_command_switch_title = t(
	'IE 11 command switch injection',
	'IE 11 命令参数注入',
	'IE 11 命令參數注入'
);
export const bio_ie11_command_switch_description = t(
	"in IE11, programs on the user's computer could be launched with arbitrary arguments by executing the scheme in an iframe. CVE-2019-0764",
	'在 IE11 中，通过在 iframe 中执行 scheme，可用任意参数启动用户电脑上的程序。CVE-2019-0764',
	'在 IE11 中，透過在 iframe 中執行 scheme，可用任意參數啟動使用者電腦上的程式。CVE-2019-0764'
);
export const bio_chromium_cross_origin_title = t(
	'Chromium cross-origin bypass',
	'Chromium 跨源绕过',
	'Chromium 跨來源繞過'
);
export const bio_chromium_cross_origin_description = t(
	'in Google Chrome, Blink, or Chromium, it was possible to bypass cross-origin restrictions by causing a refresh of a failed cross-origin request. CVE-2019-13664',
	'在 Google Chrome、Blink 或 Chromium 中，可通过刷新失败的跨源请求来绕过跨源限制。CVE-2019-13664',
	'在 Google Chrome、Blink 或 Chromium 中，可透過重新整理失敗的跨來源請求來繞過跨來源限制。CVE-2019-13664'
);
export const bio_crypto_js_pbkdf2_title = t(
	'crypto-js PBKDF2 1,000 times weaker than specified in 1993 and 1.3M times weaker than current standard',
	'crypto-js PBKDF2 比 1993 年标准弱 1000 倍，比现行标准弱 130 万倍',
	'crypto-js PBKDF2 比 1993 年標準弱 1000 倍，比現行標準弱 130 萬倍'
);
export const bio_crypto_js_pbkdf2_description = t(
	'Vulnerability in second most popular Javascript cryptography library allowing forgery of digital signatures. CVE-2023-46133',
	'第二流行的 JavaScript 密码学库中的漏洞，可伪造数字签名。CVE-2023-46133',
	'第二流行的 JavaScript 密碼學函式庫中的漏洞，可偽造數位簽章。CVE-2023-46133'
);
export const bio_crypto_es_pbkdf2_title = t(
	'crypto-es PBKDF2 1,000 times weaker than specified in 1993 and 1.3M times weaker than current standard',
	'crypto-es PBKDF2 比 1993 年标准弱 1000 倍，比现行标准弱 130 万倍',
	'crypto-es PBKDF2 比 1993 年標準弱 1000 倍，比現行標準弱 130 萬倍'
);
export const bio_crypto_es_pbkdf2_description = t(
	'Vulnerability in maintained fork of most popular Javascript cryptography library allowing forgery of digital signatures. CVE-2023-46233',
	'最流行 JavaScript 密码学库的维护分支中的漏洞，可伪造数字签名。CVE-2023-46233',
	'最流行 JavaScript 密碼學函式庫的維護分支中的漏洞，可偽造數位簽章。CVE-2023-46233'
);
export const bio_apple_hall_of_fame_title = t(
	'Apple Hall of Fame',
	'Apple 名人堂',
	'Apple 名人堂'
);
export const bio_apple_hall_of_fame_description = t(
	"For major security issue covered in 'How to Hack Apple ID'.",
	'因《如何攻击 Apple ID》中涵盖的重大安全问题入选。',
	'因《如何攻擊 Apple ID》中涵蓋的重大安全問題入選。'
);
export const bio_hackfortress_finals_title = t(
	'HackFortress Finals',
	'HackFortress 决赛',
	'HackFortress 決賽'
);
export const bio_hackfortress_finals_description = t(
	'Video of the finals of HackFortress at ShmooCon.',
	'ShmooCon 上 HackFortress 决赛的视频。',
	'ShmooCon 上 HackFortress 決賽的影片。'
);
export const bio_assistant_obstetrician_title = t(
	'Assistant Obstetrician (shadow)',
	'产科助理（跟岗）',
	'產科助理（跟崗）'
);
export const bio_assistant_obstetrician_description = t(
	'Work experience at the Royal Free Hospital NHS Trust. Spent time in world-leading virology department.',
	'在 Royal Free Hospital NHS Trust 的工作体验。曾在世界领先的病毒学部门实习。',
	'在 Royal Free Hospital NHS Trust 的工作體驗。曾在世界領先的病毒學部門實習。'
);
export const bio_parmiters_sixth_form_title = t(
	'Parmiter’s School Sixth Form, Garston',
	'Parmiter’s School 六年级学院，Garston',
	'Parmiter’s School Sixth Form，Garston'
);
export const bio_parmiters_sixth_form_description = t(
	'Graduated Sixth Form with A levels in Biology, Chemistry, Physics and Mathematics with Mechanics.',
	'六年级学院毕业，A-level 科目为生物、化学、物理和数学（力学）。',
	'Sixth Form 畢業，A-level 科目為生物、化學、物理和數學（力學）。'
);
export const bio_ict_support_title = t(
	'ICT Support Technician, The Grove Hotel, Watford, UK',
	'ICT 支持技术员，The Grove Hotel，英国 Watford',
	'ICT 支援技術員，The Grove Hotel，英國 Watford'
);
export const bio_ict_support_description = t(
	'Year 12 work experience program at luxury hotel. Networking & technical support. Decompiled and reverse-engineered .net app for ease of provisioning corporate machines via batch scripts.',
	'Year 12 在豪华酒店的工作体验项目。负责网络与技术支持。反编译并逆向工程 .NET 应用，以便通过批处理脚本配置公司电脑。',
	'Year 12 在豪華飯店的工作體驗專案。負責網路與技術支援。反編譯並逆向工程 .NET 應用，以便透過批次腳本配置公司電腦。'
);
export const bio_parmiters_secondary_title = t(
	'Parmiter’s Secondary School, Garston',
	'Parmiter’s Secondary School，Garston',
	'Parmiter’s Secondary School，Garston'
);
export const bio_parmiters_secondary_description = t(
	'Graduated Secondary School with GCSES in Biology, Chemistry, English, Geography, Electronics, Mathematics, ICT, BCS, Physics, German and English Literature.',
	'中学毕业，GCSE 科目包括生物、化学、英语、地理、电子、数学、ICT、BCS、物理、德语和英国文学。',
	'中學畢業，GCSE 科目包括生物、化學、英語、地理、電子、數學、ICT、BCS、物理、德語和英國文學。'
);

export const homepage_intro_security = t(
	'I am an internationally recognised expert on computer security, with specialisms in web security, security program (SSDLC) construction, and automated security analysis.',
	'我是国际认可的计算机安全专家，专长包括 Web 安全、安全项目（SSDLC）建设，以及自动化安全分析。',
	'我是國際認可的電腦安全專家，專長包括 Web 安全、安全計畫（SSDLC）建設，以及自動化安全分析。'
);
export const homepage_intro_openai_prefix = t(
	'I am a Member of Technical Staff at ',
	'我是 ',
	'我是 '
);
export const homepage_intro_openai_suffix = t(
	', where I work on computer security.',
	' 的技术员工，负责计算机安全工作。',
	' 的技術員工，負責電腦安全工作。'
);
export const homepage_intro_legal_prefix = t(
	'I am interested in consulting on legal cases. For business, email me at ',
	'我有兴趣为法律案件提供顾问服务。商务联系请发邮件至 ',
	'我有興趣為法律案件提供顧問服務。商務聯絡請寄信至 '
);
export const homepage_intro_selection = t(
	'A selection of my work over the years can be found below.',
	'下面可以看到我这些年来的一部分工作。',
	'下面可以看到我這些年來的一部分工作。'
);
export const homepage_about_heading = t('About.', '关于。', '關於。');
export const homepage_about_design_heading = t(
	'The design of this website.',
	'这个网站的设计。',
	'這個網站的設計。'
);
export const homepage_about_design_1 = t(
	"This website is a direct descendant of one I made in 2019. The core ideas come from very early on when I was using the internet, and I didn't want to tell people with my chosen username what kind of person I was. I picked the username zemnmez to be something meaningless that people could fill with their own ideas of who I was.",
	'这个网站直接继承自我在 2019 年做的一个版本。它的核心想法来自我很早开始使用互联网的时候：我不想让别人只凭我选择的用户名就知道我是怎样的人。我选择 zemnmez 这个用户名，是因为它本身没有意义，别人可以把他们对我的想象填进去。',
	'這個網站直接繼承自我在 2019 年做的一個版本。它的核心想法來自我很早開始使用網際網路的時候：我不想讓別人只憑我選擇的使用者名稱就知道我是怎樣的人。我選擇 zemnmez 這個使用者名稱，是因為它本身沒有意義，別人可以把他們對我的想像填進去。'
);
export const homepage_about_design_2 = t(
	"Similarly, when I made the website, I didn't want to tell people directly about myself, so instead I made this timeline to keep track of what I had done every year. The number in roman numerals is my age that year. It fulfilled another role as I was collecting my work to apply for my US O1 visa, which requires proving that you've done a lot of interesting things!",
	'同样地，做这个网站时，我也不想直接向别人介绍自己，于是做了这条时间线，用来记录我每一年做过的事情。罗马数字表示我那一年的年龄。它还有另一个用途：我当时在整理作品，用来申请美国 O1 签证，而这个签证需要证明你做过很多有意思的事。',
	'同樣地，做這個網站時，我也不想直接向別人介紹自己，於是做了這條時間線，用來記錄我每一年做過的事情。羅馬數字表示我那一年的年齡。它還有另一個用途：我當時在整理作品，用來申請美國 O1 簽證，而這個簽證需要證明你做過很多有意思的事。'
);
export const homepage_about_kenwood_1_prefix = t(
	'The background video (hero video) in summer is of a hidden area in the gardens of ',
	'夏季背景视频（hero video）拍的是 ',
	'夏季背景影片（hero video）拍的是 '
);
export const homepage_about_kenwood_1_suffix = t(
	", a beautiful stately home sandwiched between Highgate and Hampstead in London where I grew up. It's located at about ",
	' 花园里一处隐蔽的地方。Kenwood House 是一座美丽的庄园，位于我长大的伦敦 Highgate 和 Hampstead 之间。它大约位于 ',
	' 花園裡一處隱蔽的地方。Kenwood House 是一座美麗的莊園，位於我長大的倫敦 Highgate 和 Hampstead 之間。它大約位於 '
);
export const homepage_about_kenwood_2 = t(
	"I used to be that there was a bench hidden under overgrown bushes and a tree near the hydrangeas past the orangery. I took a video from there one summer - I was collecting photos and videos to remind me of home because I knew I'd leave it behind someday to move to the US.",
	'过去，穿过橘园、靠近绣球花的地方，有一张长椅藏在疯长的灌木和树下。有一年夏天我在那里拍了视频。我当时在收集能让我想起家的照片和视频，因为我知道总有一天会离开那里，搬去美国。',
	'過去，穿過橘園、靠近繡球花的地方，有一張長椅藏在瘋長的灌木和樹下。有一年夏天我在那裡拍了影片。我當時在收集能讓我想起家的照片和影片，因為我知道總有一天會離開那裡，搬去美國。'
);
export const homepage_about_winter = t(
	'In winter, a close-by location of Kenwood House in the snow is shown.',
	'冬季显示的是 Kenwood House 附近雪中的景象。',
	'冬季顯示的是 Kenwood House 附近雪中的景象。'
);
export const homepage_about_type_prefix = t(
	'The type and style itself was inspired by older, pre-computer era typsetting such as the ',
	'字体和整体风格本身受到计算机时代以前排版的启发，例如 ',
	'字體和整體風格本身受到電腦時代以前排版的啟發，例如 '
);
export const homepage_about_type_suffix = t(
	". Particular effort was put into trying to have content fill horizontal space automatically, as seen in older documents that try to make the most of the paper they're printed on.",
	'。我特别花了力气让内容尽可能自动填满横向空间，类似旧文档会尽量利用纸面宽度的做法。',
	'。我特別花了力氣讓內容盡可能自動填滿橫向空間，類似舊文件會盡量利用紙面寬度的做法。'
);
export const homepage_about_logo_heading_prefix = t(
	"What's the difference between ",
	'这两个标志有什么区别：',
	'這兩個標誌有什麼區別：'
);
export const homepage_about_logo_heading_middle = t(' and ', ' 和 ', ' 和 ');
export const homepage_about_logo_heading_suffix = t('?', '？', '？');
export const homepage_about_logo_1 = t(
	'The diamond logo came out of several years of wanting a way to express myself in art. For a few years following, I changed logo annually based how I felt the year prior, making logos with geometry and construction lines.',
	'菱形标志源于我多年来想用艺术表达自己的愿望。之后几年里，我每年都会根据前一年的感受更换标志，用几何和构造线来设计它们。',
	'菱形標誌源於我多年來想用藝術表達自己的願望。之後幾年裡，我每年都會根據前一年的感受更換標誌，用幾何和構造線來設計它們。'
);
export const homepage_about_logo_2 = t(
	'When I eventually made the diamond logo, it ended up looking a like an eye logo I made very early on in 2012. I liked it so much it came to represent the persona I had since 2009. The logo itself is from much later, probably around 2015.',
	'后来我做出菱形标志时，它看起来很像我早在 2012 年做过的一个眼睛标志。我很喜欢它，于是它逐渐代表了我自 2009 年以来使用的网络身份。这个标志本身要晚得多，大概是在 2015 年左右做的。',
	'後來我做出菱形標誌時，它看起來很像我早在 2012 年做過的一個眼睛標誌。我很喜歡它，於是它逐漸代表了我自 2009 年以來使用的網路身分。這個標誌本身要晚得多，大概是在 2015 年左右做的。'
);
export const homepage_about_time_eye_1 = t(
	'The time eye logo was the later (2019) creation, coming out of a specific need to disambiguate between the published work I had as Thomas Shadwell, my real name, versus zemnmez, the persona I had used since 2009. It became necessary after I made the Forbes Under 30 list for my tax system hack in 2018. Before this point I had worked hard to try to keep the two identities separate, but Forbes lists are not really for online personas.',
	'时间眼标志是后来（2019 年）做的，原因很具体：我需要区分以真实姓名 Thomas Shadwell 发表的作品，以及以 zemnmez 这个自 2009 年起使用的身份发表的作品。2018 年我因为税务系统漏洞研究进入福布斯 30 Under 30 后，这种区分变得必要。在那之前，我一直努力把两个身份分开，但福布斯榜单并不是给网络人格准备的。',
	'時間眼標誌是後來（2019 年）做的，原因很具體：我需要區分以真實姓名 Thomas Shadwell 發表的作品，以及以 zemnmez 這個自 2009 年起使用的身分發表的作品。2018 年我因為稅務系統漏洞研究進入富比士 30 Under 30 後，這種區分變得必要。在那之前，我一直努力把兩個身分分開，但富比士榜單並不是給網路人格準備的。'
);
export const homepage_about_eye_prefix = t(
	'The eye logo is a reference to the well-known ',
	'眼睛标志参考了著名的 ',
	'眼睛標誌參考了著名的 '
);
export const homepage_about_eye_link = t(
	'eye of providence',
	'全视之眼',
	'全視之眼'
);
export const homepage_about_eye_suffix = t(
	', a symbol that represents human achievement as being incomplete without God. I wanted it to reflect the idea that, in a universe that might not have a God, we as people have a responsibility to care for each other.',
	'，这个符号表示没有上帝时人的成就是不完整的。我希望它也能表达这样一种想法：在一个也许没有上帝的宇宙里，作为人，我们有责任彼此照顾。',
	'，這個符號表示沒有上帝時人的成就是不完整的。我希望它也能表達這樣一種想法：在一個也許沒有上帝的宇宙裡，作為人，我們有責任彼此照顧。'
);
export const homepage_about_identity = t(
	'In having to make this distinction, for a short time the work published as zemnmez continued to represent the things I was most proud of - an idealised kind of self. But at Google, I started to publish security research I was really proud of as both zemnmez and Thomas Shadwell. The abstract ideas are still there, but now I am more Thomas than I ever was.',
	'因为必须做出这种区分，在一段时间里，以 zemnmez 名义发表的作品仍然代表我最自豪的那些东西，一种理想化的自我。但在 Google 时，我开始同时以 zemnmez 和 Thomas Shadwell 的名义发表自己真正自豪的安全研究。那些抽象的想法仍然存在，但现在我比以往任何时候都更像 Thomas。',
	'因為必須做出這種區分，在一段時間裡，以 zemnmez 名義發表的作品仍然代表我最自豪的那些東西，一種理想化的自我。但在 Google 時，我開始同時以 zemnmez 和 Thomas Shadwell 的名義發表自己真正自豪的安全研究。那些抽象的想法仍然存在，但現在我比以往任何時候都更像 Thomas。'
);
