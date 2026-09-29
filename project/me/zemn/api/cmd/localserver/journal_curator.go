package main

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"strings"
	"sync"
	"time"

	"github.com/google/uuid"
	apiserver "github.com/zemn-me/monorepo/project/me/zemn/api/server"
)

// The local curator exercises the production snapshot/import path without
// sending development fixtures to an external model. Its prose is deliberately
// authored sample content, not a claim about live model output quality.
type localJournalCurator struct {
	mu      sync.Mutex
	results map[string]apiserver.JournalCurationResult
}

type reviewEntry struct {
	ID         string                               `json:"id"`
	RecordedAt time.Time                            `json:"recordedAt"`
	TimeZone   string                               `json:"timeZone"`
	Transcript []apiserver.JournalTranscriptSegment `json:"transcript"`
	Summary    *apiserver.JournalSummary            `json:"summary"`
}

type reviewBlock struct {
	text string
	// Each pair identifies a development fixture and one of its original segments.
	sources [][2]int
}

func rb(text string, sources ...[2]int) reviewBlock { return reviewBlock{text, sources} }

type reviewPage struct {
	key, title, kind string
	aliases          []string
	blocks           []reviewBlock
}

var reviewPages = []reviewPage{
	{"maya", "Maya", "person", []string{"Maya Torres", "Meyer (transcription)"}, []reviewBlock{
		rb("Maya Torres is a freelance interaction designer working on {{lantern}}. {{jo}} introduced her at {{library}} in {{month:5}}; her first suggestion was to learn from paper cards before building software.", [2]int{5, 0}, [2]int{5, 1}),
		rb("**Design position.** Maya wants the first interaction to feel like an invitation. In the conversation on {{date:1}}, she challenged the assumption that participation must produce a registration: a visitor should be able to enjoy a story and leave without an obligation.", [2]int{1, 0}, [2]int{1, 1}),
		rb("**A disagreement, then a test.** The river-walk note records an unresolved argument about sign-in. By the pilot, the team had agreed to remove that requirement. Two hesitant visitors then tried the station. This supports trying the simpler invitation again; it does not establish why every visitor participated.", [2]int{3, 0}, [2]int{3, 2}, [2]int{1, 1}, [2]int{0, 1}),
		rb("**Name clarification.** The original note from {{date:3}} says ‘Meyer’. The later recording on {{date:1}} explicitly identifies that person as Maya Torres. The original transcript is preserved, while this page and the earlier entry use the clarified identity.", [2]int{3, 0}, [2]int{1, 2}),
	}},
	{"ivo", "Ivo Chen", "person", []string{"Ivo"}, []reviewBlock{
		rb("Ivo Chen is a friend who builds audio tools and later helped with {{lantern}}. In {{month:6}}, he offered help while the listening station was still an unnamed notebook idea.", [2]int{6, 0}, [2]int{6, 2}),
		rb("**A useful phrase.** His description of an {{attention}} connects unnecessary choices with the effort required to begin. The diarist found the idea useful but explicitly resisted turning rest into an efficiency exercise.", [2]int{6, 0}, [2]int{6, 1}),
		rb("**Pilot work.** During rehearsal he investigated a half-second headphone delay; the launch recording says he fixed it before visitors arrived. The diary does not describe the final technical change.", [2]int{2, 0}, [2]int{0, 2}),
	}},
	{"jo", "Jo Alvarez", "person", []string{"Jo"}, []reviewBlock{
		rb("Jo Alvarez is the community librarian at {{library}} and the host of the {{lantern}} pilot. She connected the diarist with {{maya}} and consistently asked how the experience would feel to someone arriving alone.", [2]int{4, 0}, [2]int{5, 0}, [2]int{5, 1}),
		rb("**From suggestion to pilot.** The earliest conversation proposed one afternoon with paper cards. The later agreement remained deliberately limited: one evening, one station, and no promise of a permanent installation.", [2]int{7, 0}, [2]int{4, 0}, [2]int{4, 2}),
		rb("**An evolving plan.** Jo initially suggested collecting email addresses to invite people back. The team later tested optional sign-in instead. Following the pilot, she wanted to invite the afternoon reading group; no follow-up date is recorded.", [2]int{4, 1}, [2]int{1, 1}, [2]int{0, 2}),
	}},
	{"lantern", "Lantern", "project", []string{"Library listening station"}, []reviewBlock{
		rb("Lantern is a small listening-station experiment at {{library}}, where neighbors can encounter one local story at a time. {{maya}} works on the interaction, {{ivo}} helps with audio, and {{jo}} hosts the pilot.", [2]int{5, 0}, [2]int{5, 2}, [2]int{0, 2}),
		rb("**{{month:5}} — a paper beginning.** The team started with paper cards and the question of whether a visitor on their own would feel comfortable approaching. Permanent ownership and maintenance were left undecided.", [2]int{5, 1}, [2]int{5, 2}),
		rb("**{{date:4}} to {{date:1}} — the sign-in decision.** Email collection first looked like a useful way to follow up. Rehearsal exposed a different problem: the welcome screen felt like a form. After a disagreement and a conversation with Maya, the team chose to test the pilot without mandatory sign-in.", [2]int{4, 1}, [2]int{2, 1}, [2]int{3, 0}, [2]int{1, 1}),
		rb("**{{date:0}} — first pilot.** Jo counted eleven visitors; eight tried the station without help. Two people who hesitated at the sign-in prompt tried it after that step was removed. These observations are promising, but the diary provides no comparison group or longer-term retention data.", [2]int{0, 0}, [2]int{0, 1}),
		rb("**Next decision.** Keep the next pilot small and optional, with a possible invitation to the afternoon reading group. A permanent service, its maintainer, and a follow-up date remain unresolved. This is an example of {{experiments}} rather than a commitment to launch a full archive.", [2]int{0, 2}, [2]int{5, 2}, [2]int{4, 2}),
	}},
	{"library", "Rivermill Library", "place", []string{"Rivermill", "The reading room"}, []reviewBlock{
		rb("Rivermill Library is the setting for the {{lantern}} listening experiment. {{jo}}, the community librarian, offered a corner beside the reading room and asked for a clear way for visitors to leave.", [2]int{4, 0}),
		rb("**Why this place matters.** The idea grew from a conversation about encountering neighbors' stories by chance. Later planning centered on whether a person visiting alone would feel comfortable approaching the station.", [2]int{7, 0}, [2]int{5, 1}),
		rb("**Current activity.** The first pilot drew eleven visitors. Jo proposed inviting the afternoon reading group next; the diary does not yet record another booking or a permanent installation.", [2]int{0, 0}, [2]int{0, 2}, [2]int{4, 2}),
	}},
	{"attention", "Attention budget", "subject", []string{"Cost of beginning", "Unnecessary choices"}, []reviewBlock{
		rb("An attention budget is the diary's way of describing how notifications and unexplained choices consume effort before the useful part of an experience begins. {{ivo}} introduced the phrase on a river walk in {{month:6}}.", [2]int{6, 0}),
		rb("**A boundary on the idea.** The diarist does not want to optimize every minute of rest. The intended benefit is room for curiosity, rather than another measure of personal productivity.", [2]int{6, 1}),
		rb("**In practice.** The phrase resurfaced during the argument about {{lantern}}: asking visitors to register could spend their first minute resolving the team's uncertainty. {{maya}} later proposed an experience that someone could enjoy without creating an account.", [2]int{3, 1}, [2]int{1, 0}, [2]int{1, 1}),
		rb("**What the pilot adds.** Two hesitant visitors tried the station after the sign-in step disappeared. That is a concrete observation consistent with the idea, not proof that fewer choices are always better.", [2]int{0, 1}),
	}},
	{"experiments", "Small reversible experiments", "subject", []string{"Permission to stop", "Paper before software"}, []reviewBlock{
		rb("A small reversible experiment makes a decision cheap enough to learn from and states what would make the team stop. The phrase appears in the earliest library note, alongside relief that trying an idea need not mean running it forever.", [2]int{7, 1}, [2]int{7, 2}),
		rb("**Across the diary.** {{maya}} suggested paper cards before an app. {{jo}} later defined one evening without a permanent installation. Both choices gave {{lantern}} a useful next step without settling the entire future of the project.", [2]int{5, 1}, [2]int{4, 2}),
		rb("**An open question.** A good first pilot does not settle who would maintain the service. The next recorded intention is another small, optional pilot; ongoing ownership remains unresolved.", [2]int{5, 2}, [2]int{0, 2}),
	}},
}

var reviewAnalyses = [][]reviewBlock{
	{rb("{{lantern}} reached its first public pilot at {{library}}: eleven visitors, with eight trying the station without help. {{ivo}} had fixed the audio delay before opening.", [2]int{0, 0}, [2]int{0, 2}), rb("The important change was the invitation. {{maya}} watched two hesitant visitors try the station after sign-in disappeared. Earlier entries show this was a decision reached through disagreement and rehearsal, rather than a feature the team had always intended to omit.", [2]int{0, 1}, [2]int{3, 0}, [2]int{2, 1}, [2]int{1, 1}), rb("The next step remains another small pilot, potentially with the reading group. The diary still leaves permanent maintenance unresolved.", [2]int{0, 2}, [2]int{5, 2})},
	{rb("{{maya}} questioned whether {{lantern}} needed registrations to count as a success. The conversation shifted the test toward a visitor's first quiet minute, with agreement to remove mandatory sign-in.", [2]int{1, 0}, [2]int{1, 1}), rb("This also resolves an identity ambiguity in the river-walk recording: the person transcribed as ‘Meyer’ was Maya Torres. The earlier disagreement belongs to the same design conversation; the quote itself remains unchanged.", [2]int{1, 2}, [2]int{3, 0})},
	{rb("Rehearsal at {{library}} exposed two kinds of friction: {{ivo}} investigated a headphone delay, while {{jo}} mistook the welcome screen for an account requirement. The team simplified the main action to a single Listen button.", [2]int{2, 0}, [2]int{2, 1}, [2]int{2, 2}), rb("Sign-in was still unresolved that day. The later conversation with {{maya}} and the pilot make the outcome clearer, but should not be read as a decision already made during this rehearsal.", [2]int{2, 2}, [2]int{1, 1}, [2]int{0, 1})},
	{rb("The river walk surfaced a disagreement about {{lantern}}: collecting names for follow-up might make the first interaction feel like work. The entry explicitly leaves the question unsettled.", [2]int{3, 0}, [2]int{3, 2}), rb("**Later clarification.** The person transcribed here as ‘Meyer’ is identified as {{maya}} in the recording from {{date:1}}. Her {{attention}} argument also echoes the earlier river conversation with {{ivo}}, though the diary does not establish whether she had heard his phrasing.", [2]int{3, 0}, [2]int{3, 1}, [2]int{1, 2}, [2]int{6, 0})},
	{rb("{{jo}} gave {{lantern}} a practical home at {{library}} and a limited shape: one listening station, one evening, and permission to walk away. This turns {{experiments}} into a concrete commitment.", [2]int{4, 0}, [2]int{4, 2}, [2]int{7, 1}), rb("Email collection initially appealed as a way to invite visitors back and report a number. Later recordings show that plan changing after rehearsal and discussion with {{maya}}; it was still an open assumption here.", [2]int{4, 1}, [2]int{2, 1}, [2]int{1, 1})},
	{rb("{{lantern}} acquired a name and a small team at {{library}}. {{jo}} introduced {{maya}}, whose paper-card proposal kept the first question focused on a visitor's comfort rather than implementation.", [2]int{5, 0}, [2]int{5, 1}), rb("The project was framed as one story at a time, with maintenance deliberately unresolved. This builds on the older idea of {{experiments}}; the later pilot retains that limited commitment.", [2]int{5, 2}, [2]int{7, 1}, [2]int{4, 2})},
	{rb("{{ivo}} introduced the {{attention}} metaphor during a river walk and offered help with an unnamed library idea. At this point there was no project schedule or deadline.", [2]int{6, 0}, [2]int{6, 2}), rb("The diarist's qualification matters: leaving room for curiosity should not turn rest into another optimization task. Later {{lantern}} discussions apply the metaphor to the cost of beginning, rather than to personal productivity.", [2]int{6, 1}, [2]int{3, 1})},
	{rb("A conversation with {{jo}} at {{library}} made the storytelling idea feel possible by reducing its scale to one afternoon with paper cards. There was no team or timetable yet.", [2]int{7, 0}, [2]int{7, 2}), rb("The phrase {{experiments}} captures the relief of being allowed to stop. Later notes connect this beginning to {{lantern}}, but its name and collaborators had not yet been established here.", [2]int{7, 1}, [2]int{5, 0})},
}

var reviewCalendarEvents = []reviewBlock{
	rb("{{lantern}} opened at {{library}}. Eleven visitors came; eight tried the station without help. Two hesitant visitors participated after sign-in was removed.", [2]int{0, 0}, [2]int{0, 1}),
	rb("Over coffee, {{maya}} and the diarist agreed to test participation without mandatory sign-in. The recording also clarified that the earlier ‘Meyer’ reference meant Maya Torres.", [2]int{1, 1}, [2]int{1, 2}),
	rb("At rehearsal, {{ivo}} investigated headphone latency and {{jo}} mistook the welcome screen for an account requirement. The main action was reduced to one Listen button.", [2]int{2, 0}, [2]int{2, 1}, [2]int{2, 2}),
	rb("A river-walk discussion left the value of collecting names unresolved. The original transcript names ‘Meyer’; a later recording on {{date:1}} identifies the person as {{maya}}.", [2]int{3, 0}, [2]int{3, 2}, [2]int{1, 2}),
	rb("{{jo}} offered a corner beside the reading room for one evening. Email collection was proposed for follow-up, while any permanent installation remained outside the agreement.", [2]int{4, 0}, [2]int{4, 1}, [2]int{4, 2}),
	rb("{{jo}} introduced {{maya}} and {{lantern}} acquired its name. Paper cards were proposed before software; long-term ownership was left undecided.", [2]int{5, 0}, [2]int{5, 1}, [2]int{5, 2}),
	rb("{{ivo}} described an {{attention}} and offered help with an unnamed listening-station idea. The diarist wanted room for curiosity without turning rest into another productivity measure.", [2]int{6, 0}, [2]int{6, 1}, [2]int{6, 2}),
	rb("A conversation with {{jo}} at {{library}} proposed one afternoon of paper cards. The diarist described the relief of trying {{experiments}} without promising to continue indefinitely.", [2]int{7, 0}, [2]int{7, 1}, [2]int{7, 2}),
}

func reviewPageID(key string) uuid.UUID {
	if key == "maya" {
		return uuid.MustParse("cc6010d8-69d2-4f88-a2da-aed75ca48198")
	}
	return uuid.NewSHA1(uuid.NameSpaceURL, []byte("https://local.zemn.me/fictional-journal/"+key))
}

func (c *localJournalCurator) Prepare(_ context.Context, runID string, data []byte) (string, error) {
	var corpus struct {
		Entries []reviewEntry                     `json:"entries"`
		Periods []apiserver.JournalCalendarPeriod `json:"periods"`
	}
	if err := json.Unmarshal(data, &corpus); err != nil {
		return "", err
	}
	byFixture := map[int]reviewEntry{}
	fixtureFor := func(entry reviewEntry) int {
		for i, fixture := range developmentJournalFixtures {
			if len(entry.Transcript) > 0 && entry.Transcript[0].Text == fixture.transcript[0] {
				return i
			}
		}
		return -1
	}
	for _, entry := range corpus.Entries {
		if i := fixtureFor(entry); i >= 0 {
			byFixture[i] = entry
		}
	}
	expand := func(text string) string {
		for _, page := range reviewPages {
			text = strings.ReplaceAll(text, "{{"+page.key+"}}", "["+page.title+"](/journal?wiki="+reviewPageID(page.key).String()+")")
		}
		for i, entry := range byFixture {
			location, err := time.LoadLocation(entry.TimeZone)
			if err != nil {
				location = time.UTC
			}
			date := entry.RecordedAt.In(location)
			text = strings.ReplaceAll(text, fmt.Sprintf("{{date:%d}}", i), date.Format("2 January 2006"))
			text = strings.ReplaceAll(text, fmt.Sprintf("{{month:%d}}", i), date.Format("January 2006"))
		}
		return text
	}
	render := func(blocks []reviewBlock, own *reviewEntry) ([]apiserver.JournalSummaryBlock, error) {
		result := []apiserver.JournalSummaryBlock{}
		for _, block := range blocks {
			rendered := apiserver.JournalSummaryBlock{Markdown: expand(block.text), Citations: []apiserver.JournalCitation{}}
			for _, source := range block.sources {
				entry, ok := byFixture[source[0]]
				if own != nil && fixtureFor(*own) == source[0] {
					entry, ok = *own, true
				}
				if !ok || source[1] >= len(entry.Transcript) {
					return nil, errors.New("review fixture is missing original evidence")
				}
				segment := entry.Transcript[source[1]]
				rendered.Citations = append(rendered.Citations, apiserver.JournalCitation{EntryId: entry.ID, SegmentId: segment.Id, Quote: segment.Text})
				rendered.Markdown += fmt.Sprintf("[^%d]", len(rendered.Citations))
			}
			result = append(result, rendered)
		}
		return result, nil
	}
	result := apiserver.JournalCurationResult{Periods: []apiserver.JournalCuratedPeriod{}, Entries: []apiserver.JournalCuratedEntry{}, Pages: []apiserver.JournalWikiPage{}}
	for _, entry := range corpus.Entries {
		if entry.Summary == nil {
			return "", errors.New("local wiki fixtures require entry summaries")
		}
		blocks := entry.Summary.Blocks
		if index := fixtureFor(entry); index >= 0 {
			var err error
			blocks, err = render(reviewAnalyses[index], &entry)
			if err != nil {
				return "", err
			}
		}
		result.Entries = append(result.Entries, apiserver.JournalCuratedEntry{EntryId: uuid.MustParse(entry.ID), Title: entry.Summary.Title, Blocks: blocks})
	}
	for _, page := range reviewPages {
		blocks, err := render(page.blocks, nil)
		if err != nil {
			return "", err
		}
		result.Pages = append(result.Pages, apiserver.JournalWikiPage{Id: reviewPageID(page.key), Title: page.title, Kind: apiserver.JournalWikiPageKind(page.kind), Aliases: page.aliases, Blocks: blocks})
	}
	for _, period := range corpus.Periods {
		members := map[string]bool{}
		for _, id := range period.EntryIds {
			members[id] = true
		}
		indices := []int{}
		for i := range developmentJournalFixtures {
			if members[byFixture[i].ID] {
				indices = append(indices, i)
			}
		}
		if len(indices) == 0 {
			// Other browser flows upload their own recordings before sample data.
			// Keep those periods covered using their original, cited local analysis.
			blocks := []apiserver.JournalSummaryBlock{}
			for _, entry := range corpus.Entries {
				if members[entry.ID] && entry.Summary != nil {
					blocks = append(blocks, entry.Summary.Blocks...)
				}
			}
			result.Periods = append(result.Periods, apiserver.JournalCuratedPeriod{PeriodId: period.Id, Title: "Recorded events", Blocks: blocks})
			continue
		}
		latest := indices[0]
		title := "A small idea takes shape"
		intro := rb("The surviving notes from this period introduce a modest library storytelling idea. A conversation with {{jo}} at {{library}} made room for {{experiments}}, with neither a team nor a timetable yet in place.", [2]int{7, 0}, [2]int{7, 1}, [2]int{7, 2})
		switch latest {
		case 0, 1:
			title = "Lantern reaches its first audience"
			intro = rb("{{lantern}} moved from planning into a first public pilot at {{library}}. The central question became how to let a visitor begin without an obligation to register; {{maya}}, {{ivo}} and {{jo}} each helped turn that question into a small, observable test.", [2]int{0, 0}, [2]int{0, 1}, [2]int{0, 2}, [2]int{1, 1})
		case 2:
			title = "Rehearsing the invitation"
			intro = rb("The recorded work on {{lantern}} concerned the first moments of participation. Rehearsal exposed an audio delay and a welcome screen that looked like an account requirement; mandatory sign-in was still undecided.", [2]int{2, 0}, [2]int{2, 1}, [2]int{2, 2})
		case 3:
			title = "An unresolved question of participation"
			intro = rb("A river-walk conversation challenged a working assumption behind {{lantern}}: whether collecting names for follow-up was worth the effort imposed on a new visitor. The note leaves the disagreement unresolved.", [2]int{3, 0}, [2]int{3, 2})
		case 4:
			title = "A place and a boundary for Lantern"
			intro = rb("{{jo}} offered {{lantern}} a home at {{library}}. The recorded agreement was deliberately limited to one evening and one station, with permission for visitors to leave and no permanent installation promised.", [2]int{4, 0}, [2]int{4, 2})
		case 5:
			title = "Lantern begins on paper"
			intro = rb("{{lantern}} acquired a name and collaborators at {{library}}. {{jo}} introduced {{maya}}, whose suggestion to begin with paper cards put the visitor's experience ahead of building an application.", [2]int{5, 0}, [2]int{5, 1})
		case 6:
			title = "Making room for curiosity"
			intro = rb("A conversation with {{ivo}} introduced the idea of an {{attention}}: the effort consumed by unnecessary choices before an experience begins. An unnamed library listening idea remained a notebook possibility, without a deadline.", [2]int{6, 0}, [2]int{6, 2})
		}
		if latest == 0 {
			switch period.Period {
			case "year":
				title = "From a notebook idea to a public pilot"
				intro = rb("The recordings from this year trace {{lantern}} from an unnamed notebook idea to a listening-station pilot at {{library}}. {{ivo}}'s {{attention}} conversation preceded the project team taking shape with {{maya}}; by {{month:0}}, the focus had shifted to what a visitor needed in order to begin. These are the developments preserved in the diary, not a complete account of the year.", [2]int{6, 0}, [2]int{6, 2}, [2]int{5, 0}, [2]int{0, 0}, [2]int{0, 1})
			case "month":
				title = "Testing how an invitation works"
				intro = rb("The month's recorded work turned {{lantern}} into a first public pilot at {{library}}. Plans to collect email addresses met a practical objection during rehearsal: the welcome screen felt like a form. Discussion with {{maya}} led to a test without mandatory sign-in, followed by a small but encouraging response from visitors.", [2]int{4, 1}, [2]int{2, 1}, [2]int{1, 1}, [2]int{0, 1})
			case "week":
				title = "Lantern's first public pilot"
			case "day":
				title = "The first Lantern pilot"
			}
		}
		blocks := []reviewBlock{intro}
		for n := len(indices) - 1; n >= 0; n-- {
			i := indices[n]
			event := reviewCalendarEvents[i]
			date := fmt.Sprintf("{{date:%d}}", i)
			// Calendar links are supplied by the same manifest used by the importer.
			for _, day := range corpus.Periods {
				if day.Period != "day" {
					continue
				}
				for _, id := range day.EntryIds {
					if id == byFixture[i].ID {
						date = "[" + date + "](" + day.Href + ")"
					}
				}
			}
			event.text = "- **" + date + ".** " + event.text
			if n == len(indices)-1 {
				event.text = "## Events\n\n" + event.text
			}
			blocks = append(blocks, event)
		}
		if latest <= 1 {
			blocks = append(blocks, rb("## Participation and the cost of beginning\n\nThe pilot gave {{attention}} a practical expression: two visitors tried the station after the sign-in step was removed. The phrase had appeared in the earlier conversation with {{ivo}} on {{date:6}}. This is an observation consistent with the idea, not proof that simpler interfaces always work better.", [2]int{0, 1}, [2]int{6, 0}), rb("## Open questions\n\n{{jo}} proposed inviting the afternoon reading group next. No date is recorded, and permanent maintenance remains unresolved. The plan still fits {{experiments}} rather than a commitment to operate a full archive.", [2]int{0, 2}, [2]int{5, 2}, [2]int{7, 1}))
		} else {
			blocks = append(blocks, rb("## Later developments\n\nBy {{date:0}}, {{lantern}} had reached a first pilot with eleven visitors. That later outcome puts these earlier notes in context; it does not make the eventual design or a permanent service a settled plan at the time. Maintenance remained an open question.", [2]int{0, 0}, [2]int{0, 2}, [2]int{5, 2}))
		}
		rendered, err := render(blocks, nil)
		if err != nil {
			return "", err
		}
		result.Periods = append(result.Periods, apiserver.JournalCuratedPeriod{PeriodId: period.Id, Title: title, Blocks: rendered})
	}
	c.mu.Lock()
	defer c.mu.Unlock()
	if c.results == nil {
		c.results = map[string]apiserver.JournalCurationResult{}
	}
	c.results[runID] = result
	return runID, nil
}
func (c *localJournalCurator) Start(context.Context, string, string) error { return nil }
func (c *localJournalCurator) Collect(_ context.Context, sessionID string) (*apiserver.JournalCurationResult, error) {
	c.mu.Lock()
	defer c.mu.Unlock()
	result, ok := c.results[sessionID]
	if !ok {
		return nil, errors.New("local curator session missing")
	}
	return &result, nil
}
func (c *localJournalCurator) Cleanup(_ context.Context, _ string, sessionID string) error {
	c.mu.Lock()
	defer c.mu.Unlock()
	delete(c.results, sessionID)
	return nil
}
