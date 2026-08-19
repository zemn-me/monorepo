package main

import (
	"bytes"
	"context"
	"encoding/binary"
	"encoding/json"
	"fmt"
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

var developmentJournalFixtures = []developmentJournalFixture{
	{
		title:   "A slow morning and a clear plan",
		summary: "A quiet walk made the day feel less rushed, and three deliberately small priorities replaced an intimidating task list.",
		transcript: []string{
			"I walked around the lake before opening my laptop, and the extra half hour made the whole morning feel less compressed.",
			"Instead of carrying the entire week in my head, I wrote down three things that would make today feel complete.",
			"The surprising part was that choosing less made me more eager to begin, not less ambitious.",
		},
	},
	{
		title:   "Dinner, laughter, and an honest question",
		summary: "Dinner with Maya moved from easy laughter into an honest conversation about staying close when work becomes consuming.",
		transcript: []string{
			"Maya and I found the tiny noodle place she had been talking about, and we laughed through most of dinner.",
			"She asked whether I disappear into work when I am worried, and I could tell the question mattered more than my first answer allowed.",
			"By the time we left, I had promised to name that feeling sooner instead of making her guess where I had gone.",
		},
	},
	{
		title:   "The prototype finally felt simple",
		summary: "Removing controls from the prototype revealed the interaction it had been trying to become, turning a frustrating review into a useful design lesson.",
		transcript: []string{
			"The prototype review started badly because every screen was explaining itself twice and still felt hard to use.",
			"Once I removed the extra toolbar, the main gesture became obvious and the whole thing suddenly felt calmer.",
			"I want to remember that clarity often arrives through subtraction, especially when I feel tempted to add one more label.",
		},
	},
	{
		title:   "Calling home",
		summary: "A call home carried both concern about Dad's appointment and relief that everyone could speak plainly about what happens next.",
		transcript: []string{
			"I called home after lunch and Mum gave me the fuller version of Dad's appointment rather than the reassuring headline.",
			"There is another test next month, but nobody sounded panicked, and it helped to talk about the practical plan.",
			"I felt the familiar distance of being far away, then a little better after putting the next call in the calendar.",
		},
	},
	{
		title:   "Rain on the cabin roof",
		summary: "A rainy cabin weekend created enough quiet to read, cook, and notice how thoroughly rest changes the texture of attention.",
		transcript: []string{
			"It rained against the cabin roof for almost the entire afternoon, so I made soup and finished the novel by the window.",
			"There was nowhere useful to go and nothing urgent to optimize, which was exactly what I needed.",
			"I came home wanting to protect a smaller version of that quiet inside an ordinary week.",
		},
	},
	{
		title:   "Learning the shape of the new team",
		summary: "The first month with the new team brought early trust, a few avoidable misunderstandings, and a clearer sense of how to collaborate well.",
		transcript: []string{
			"A month into the new team, I am beginning to understand which conversations need a document and which need a walk.",
			"We repaired two misunderstandings quickly this week, mostly because everyone was willing to say what they had assumed.",
			"I still feel new, but I no longer feel like I am waiting outside the real work.",
		},
	},
	{
		title:   "The trip I nearly cancelled",
		summary: "A nearly cancelled coastal trip became a reminder that anticipation is not a reliable forecast of enjoyment.",
		transcript: []string{
			"I nearly cancelled the coast trip because the train felt complicated and I was already tired before packing.",
			"By sunset we were eating chips on the sea wall, and I could not believe how close I had come to missing it.",
			"The lesson is not to say yes to everything, but to distrust the version of me who predicts the whole weekend from Friday fatigue.",
		},
	},
	{
		title:   "A year with more room in it",
		summary: "Looking back, the year felt less defined by its milestones than by a gradual shift toward friendship, steadier work, and unhurried time.",
		transcript: []string{
			"This year looked busy on the calendar, but the moments I remember best are the ones where time seemed to widen.",
			"I became better at asking friends for company before loneliness turned into a private theory about my life.",
			"Work is still important to me, but it no longer needs to occupy every empty surface in order to feel meaningful.",
		},
	},
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
		response.Header().Set("Content-Type", "application/json")
		_ = json.NewEncoder(response).Encode(map[string]int{"entries": len(developmentJournalFixtures)})
	})
}
