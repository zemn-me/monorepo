package main

import (
	"bytes"
	"context"
	"encoding/binary"
	"encoding/json"
	"fmt"
	"log"
	"net/http"
	"sync"
	"time"

	"github.com/aws/aws-sdk-go-v2/aws"
	"github.com/aws/aws-sdk-go-v2/service/s3"
	apiserver "github.com/zemn-me/monorepo/project/me/zemn/api/server"
	"github.com/zemn-me/monorepo/project/me/zemn/api/server/auth"
)

const localJournalSeedPath = "/__local/journal/seed"

type developmentJournalFixture struct {
	title      string
	summary    string
	transcript []string
}

// Fictional, connected stories let reviewers inspect cross-date evidence,
// ambiguous names, changing plans, and calendar browsing in the real UI.
var developmentJournalFixtures = []developmentJournalFixture{
	{title: "A quieter kind of launch", summary: "Eleven visitors came to the Lantern pilot. Two tried the station after the sign-in step was removed.", transcript: []string{
		"Tonight we ran the Lantern pilot at Rivermill Library. Jo counted eleven visitors, and eight tried the listening station without asking for help.",
		"Maya Torres stayed near the door and watched rather than explaining the screen. Two people who hesitated at the sign-in prompt tried it once we removed that step.",
		"Ivo Chen fixed the headphone delay before we opened. We decided to keep the next pilot small and optional, and Jo wants to invite the afternoon reading group.",
	}},
	{title: "Coffee with Maya before the pilot", summary: "Maya challenged the idea that a successful pilot needs registrations. The aim is to make the first invitation feel easy.", transcript: []string{
		"Over coffee, Maya Torres said Lantern should offer someone a quiet first minute, not a new account to look after. She is the designer I have been working with since July.",
		"I had treated registrations as proof that the project mattered. Maya asked whether someone could enjoy a story and leave without owing us anything. We agreed to try the pilot without mandatory sign-in.",
		"The person I called Meyer in my river-walk note was Maya Torres, not a new collaborator. We were discussing the same Lantern sign-in screen.",
	}},
	{title: "The rehearsal found the wrong problem", summary: "At rehearsal, Ivo investigated a headphone delay and Jo asked whether she needed an account. The team simplified the screen.", transcript: []string{
		"Ivo Chen and I rehearsed Lantern at Rivermill Library. The headphones lagged by half a second, which he thinks is a buffering problem rather than a broken device.",
		"Jo Alvarez tried the screen and asked whether she needed an account before touching anything. I realized our welcome screen looked like a form, even though we wanted it to feel like an invitation.",
		"We removed the extra toolbar and put one large Listen button in the middle. The sign-in question is still unresolved; I want to talk to Maya before the pilot.",
	}},
	{title: "An argument on the river path", summary: "A walk brought the Lantern disagreement into focus: collecting useful feedback might also make participation feel like work.", transcript: []string{
		"I walked by the river with Meyer after work. We argued about whether Lantern needs sign-in on the first screen; I wanted names so we could follow up with visitors.",
		"She said that attention is a budget, and we were spending the visitor's first minute on our own uncertainty. I was defensive at first, but I kept thinking about it on the way home.",
		"We did not settle the question. I still think feedback matters, but perhaps asking for it can happen after someone has actually heard a story.",
	}},
	{title: "Jo's practical questions", summary: "Jo helped turn the library idea into a small pilot, while leaving the registration decision open.", transcript: []string{
		"Jo Alvarez, the community librarian at Rivermill Library, offered us a corner beside the reading room for a Lantern pilot. She asked for one listening station and a clear way to walk away.",
		"Jo initially suggested collecting email addresses so she could invite people back. I liked that because it would give us a number to report, although we had not asked visitors whether they wanted follow-up.",
		"We agreed on a small reversible experiment: one evening, no permanent installation, and a conversation afterward about what surprised us. A successful pilot would not automatically mean a permanent service.",
	}},
	{title: "Lantern begins on paper", summary: "Maya and Jo helped define Lantern as a low-pressure way to encounter local stories, with a paper prototype before any software.", transcript: []string{
		"At Rivermill Library I met Maya Torres, a freelance interaction designer, through Jo Alvarez. We sketched Lantern: a listening station where neighbors can hear short local stories.",
		"Maya suggested trying paper cards before building the app. Jo cared most about whether someone visiting alone would feel comfortable approaching it.",
		"I wrote down that Lantern is not an archive of everything. It is an invitation to one story at a time. We have not decided who would maintain it if it becomes permanent.",
	}},
	{title: "Ivo's attention budget", summary: "A river walk with Ivo introduced a useful way to think about attention: every unnecessary decision spends a little of it.", transcript: []string{
		"Ivo Chen, my friend who builds audio tools, called attention a budget while we were walking beside the river. Every notification and unexplained choice spends some of it before the useful part begins.",
		"I liked the idea, but I do not want to turn rest into another efficiency contest. The point is to leave room for curiosity, not measure every minute.",
		"Ivo offered to help if I ever made the library listening idea real. At this point it is a notebook sketch, not a project with a name or deadline.",
	}},
	{title: "Permission to try something small", summary: "A conversation at the library planted the idea of testing a small invitation before committing to a large project.", transcript: []string{
		"I spoke to Jo Alvarez at Rivermill Library about putting neighbors' stories somewhere people might stumble across them. She suggested a single afternoon with paper cards before worrying about a permanent installation.",
		"I wrote small reversible experiments at the top of the page. Make the decision cheap enough to learn from, and say in advance what would make us stop.",
		"There is no team or schedule yet. I mostly felt relieved that trying an idea did not have to mean promising to run it forever.",
	}},
}

func developmentJournalFixtureForByteLength(byteLength int64) *developmentJournalFixture {
	const (
		wavHeaderBytes = 44
		bytesPerSecond = 8000 * 2
		firstSeconds   = 7
	)
	index := int((byteLength-wavHeaderBytes)/bytesPerSecond) - firstSeconds
	if byteLength != wavHeaderBytes+int64(index+firstSeconds)*bytesPerSecond || index < 0 || index >= len(developmentJournalFixtures) {
		return nil
	}
	return &developmentJournalFixtures[index]
}

func developmentJournalWAV(seconds int) []byte {
	const (
		sampleRate     = 8000
		bytesPerSample = 2
	)
	dataSize := sampleRate * seconds * bytesPerSample
	buffer := bytes.NewBuffer(make([]byte, 0, 44+dataSize))
	buffer.WriteString("RIFF")
	_ = binary.Write(buffer, binary.LittleEndian, uint32(36+dataSize))
	buffer.WriteString("WAVEfmt ")
	_ = binary.Write(buffer, binary.LittleEndian, uint32(16))
	_ = binary.Write(buffer, binary.LittleEndian, uint16(1))
	_ = binary.Write(buffer, binary.LittleEndian, uint16(1))
	_ = binary.Write(buffer, binary.LittleEndian, uint32(sampleRate))
	_ = binary.Write(buffer, binary.LittleEndian, uint32(sampleRate*bytesPerSample))
	_ = binary.Write(buffer, binary.LittleEndian, uint16(bytesPerSample))
	_ = binary.Write(buffer, binary.LittleEndian, uint16(8*bytesPerSample))
	buffer.WriteString("data")
	_ = binary.Write(buffer, binary.LittleEndian, uint32(dataSize))
	buffer.Write(make([]byte, dataSize))
	return buffer.Bytes()
}

func developmentJournalRecordedTimes(now time.Time) []time.Time {
	location := now.Location()
	localDay := time.Date(now.Year(), now.Month(), now.Day(), 0, 0, 0, 0, location)
	return []time.Time{
		localDay.AddDate(0, 0, -1).Add(19*time.Hour + 10*time.Minute),
		localDay.AddDate(0, 0, -1).Add(8*time.Hour + 25*time.Minute),
		localDay.AddDate(0, 0, -3).Add(17*time.Hour + 40*time.Minute),
		localDay.AddDate(0, 0, -8).Add(20*time.Hour + 5*time.Minute),
		localDay.AddDate(0, 0, -18).Add(16*time.Hour + 30*time.Minute),
		localDay.AddDate(0, -2, -4).Add(18*time.Hour + 15*time.Minute),
		localDay.AddDate(0, -7, -2).Add(21*time.Hour + 20*time.Minute),
		localDay.AddDate(-1, -2, -6).Add(11*time.Hour + 45*time.Minute),
	}
}

func newDevelopmentJournalSeedHandler(server *apiserver.Server, store *localJournalStore) http.Handler {
	var seedMu sync.Mutex
	return http.HandlerFunc(func(response http.ResponseWriter, request *http.Request) {
		response.Header().Set("Access-Control-Allow-Origin", "*")
		response.Header().Set("Access-Control-Allow-Methods", "POST, OPTIONS")
		if request.Method == http.MethodOptions {
			response.WriteHeader(http.StatusNoContent)
			return
		}
		if request.Method != http.MethodPost {
			http.Error(response, "method not allowed", http.StatusMethodNotAllowed)
			return
		}

		seedMu.Lock()
		defer seedMu.Unlock()
		location, err := time.LoadLocation("America/Los_Angeles")
		if err != nil {
			http.Error(response, err.Error(), http.StatusInternalServerError)
			return
		}
		ctx := context.WithValue(request.Context(), auth.IDTokenKey, &auth.IDToken{
			Issuer: "http://localhost", Subject: "integration-test-local",
		})
		for index, recordedAt := range developmentJournalRecordedTimes(time.Now().In(location)) {
			audio := developmentJournalWAV(index + 7)
			created, err := server.PostJournalEntries(ctx, apiserver.PostJournalEntriesRequestObject{
				Body: &apiserver.JournalEntryCreate{
					ContentType: apiserver.JournalEntryCreateContentType("audio/wav"),
					RecordedAt:  recordedAt,
					TimeZone:    location.String(),
				},
			})
			if err != nil {
				http.Error(response, fmt.Sprintf("create fixture %d: %v", index, err), http.StatusInternalServerError)
				return
			}
			entryID := created.(apiserver.PostJournalEntries201JSONResponse).Entry.Id.String()
			key := "entries/" + entryID + "/source"
			if _, err := store.PutObject(ctx, &s3.PutObjectInput{
				Bucket: aws.String("local-journal"), Key: aws.String(key), Body: bytes.NewReader(audio), ContentType: aws.String("audio/wav"),
			}); err != nil {
				http.Error(response, fmt.Sprintf("store fixture %d: %v", index, err), http.StatusInternalServerError)
				return
			}
			if err := server.ProcessJournalUpload(ctx, "local-journal", key, int64(len(audio))); err != nil {
				http.Error(response, fmt.Sprintf("process fixture %d: %v", index, err), http.StatusInternalServerError)
				return
			}
		}
		if err := server.RefreshJournalSummaries(ctx, time.Now()); err != nil {
			http.Error(response, fmt.Sprintf("refresh summaries: %v", err), http.StatusInternalServerError)
			return
		}
		// Advance the deterministic local session through submit, publish and
		// cleanup, exercising exactly the same importer as scheduled runs.
		for range 3 {
			if err := server.RefreshJournalKnowledge(ctx, time.Now()); err != nil {
				log.Printf("curate journal fixtures: %v", err)
				http.Error(response, fmt.Sprintf("curate fixtures: %v", err), http.StatusInternalServerError)
				return
			}
		}
		response.Header().Set("Content-Type", "application/json")
		_ = json.NewEncoder(response).Encode(map[string]int{"entries": len(developmentJournalFixtures)})
	})
}
