package main

import (
	"context"
	"encoding/base64"
	"encoding/json"
	"errors"
	"flag"
	"fmt"
	"io"
	"log"
	"net"
	"net/http"
	"net/url"
	"strconv"
	"strings"

	"github.com/gorilla/websocket"
	"github.com/twilio/twilio-go/twiml"
	"golang.org/x/sync/errgroup"

	"github.com/zemn-me/monorepo/go/openai"
)

var (
	openaiAPIKey string
	upgrader     = websocket.Upgrader{
		ReadBufferSize:  1024,
		WriteBufferSize: 1024,
		CheckOrigin:     func(r *http.Request) bool { return true },
	}
)

type ErrorHTTPHandler interface {
	ServeHTTP(http.ResponseWriter, *http.Request) error
}

var _ ErrorHTTPHandler = ErrorHTTPHandlerFunc(
	func(http.ResponseWriter, *http.Request) error { return nil },
)

type ErrorHTTPHandlerFunc func(http.ResponseWriter, *http.Request) error

func (e ErrorHTTPHandlerFunc) ServeHTTP(h http.ResponseWriter, r *http.Request) (err error) {
	return e(h, r)
}

func HTTPErrorHandler(h ErrorHTTPHandler) http.Handler {
	return http.HandlerFunc(func(rw http.ResponseWriter, rq *http.Request) {
		err := h.ServeHTTP(rw, rq)

		if err == nil {
			return
		}

		rw.Header().Add("Content-Type", "text/plain")

		code := http.StatusInternalServerError

		errStr := http.StatusText(code)
		log.Println(err)

		errStr, err = fmt.Sprintf("Error: %+v", err), nil
		if err != nil {
			err = fmt.Errorf("Formatting http error: %v", err)
			errStr, err = fmt.Sprintf("Error: %+v", err), nil
			log.Println(err)
		}

		_, err = io.Copy(rw, strings.NewReader(
			errStr,
		))
		if err != nil {
			log.Println(err)
		}
	})
}

var address string

func init() {
	flag.StringVar(&openaiAPIKey, "openai_api_key", "", "Your OpenAI API key.")
	flag.StringVar(&address, "listen", ":http-alt", "The address to listen on.")
}

func Do() (err error) {
	// Define the command-line flag for the OpenAI API key

	if openaiAPIKey == "" {
		fmt.Println("Missing openai_api_key.")
		err = flag.ErrHelp
	}

	http.HandleFunc("/", indexPage)
	http.Handle("/incoming-call", HTTPErrorHandler(ErrorHTTPHandlerFunc((handleIncomingCall))))
	http.Handle("/media-stream", HTTPErrorHandler(ErrorHTTPHandlerFunc(handleMediaStream)))

	host, port, err := net.SplitHostPort(address)
	if err != nil {
		return
	}

	var portNumber int
	portNumber, err = net.LookupPort("tcp", port)
	if err != nil {
		return
	}

	log.Printf("Server listening on %s", net.JoinHostPort(host, strconv.Itoa(portNumber)))
	err = http.ListenAndServe(address, nil)
	if err != nil {
		log.Fatal("ListenAndServe:", err)
	}

	return
}

func main() {
	flag.Parse()
	var err error
	if err := Do(); err == nil {
		return
	}

	if errors.Is(err, flag.ErrHelp) {
		flag.PrintDefaults()
		return
	}

	panic(err)
}

// indexPage handles the root endpoint and returns a simple message.
func indexPage(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")
	w.Write([]byte(`{"message": "Twilio Media Stream Server is running!"}`))
}

// handleIncomingCall handles incoming calls and returns a TwiML response to connect to the media stream.
func handleIncomingCall(w http.ResponseWriter, r *http.Request) (err error) {
	ml, err := twiml.Voice([]twiml.Element{
		twiml.VoiceConnect{
			InnerElements: []twiml.Element{
				twiml.VoiceStream{
					Url: (&url.URL{
						Scheme: "wss",
						Host:   r.Host,
						Path:   "media-stream",
					}).String(),
				},
			},
		},
	})
	if err != nil {
		err = fmt.Errorf("Generating twiml: %v", err)
		return
	}

	w.Header().Set("Content-Type", "application/xml")
	_, err = w.Write([]byte(ml))
	return
}

// handleMediaStream handles WebSocket connections between Twilio and OpenAI.
func handleMediaStream(w http.ResponseWriter, r *http.Request) (err error) {
	ctx := r.Context()

	wsConn, err := upgrader.Upgrade(w, r, nil)
	if err != nil {
		err = fmt.Errorf("Upgrading HTTP connection to websocket: %v", err)
		return
	}
	defer wsConn.Close()
	log.Println("Client connected")

	url := &url.URL{
		Scheme: "wss",
		Host:   "api.openai.com",
		Path:   "v1/realtime",
		RawQuery: url.Values{
			"model": []string{"gpt-4o-realtime-preview-2024-10-01"},
		}.Encode(),
	}

	headers := http.Header{
		"Authorization": []string{fmt.Sprintf("Bearer %s", openaiAPIKey)},
		"OpenAI-Beta":   []string{"realtime=v1"},
	}

	dialer := websocket.Dialer{}
	openaiConn, _, err := dialer.DialContext(ctx, url.String(), headers)
	if err != nil {
		err = fmt.Errorf("Error connecting to OpenAI WebSocket: %v", err)
		return
	}
	defer openaiConn.Close()

	// Send session update to OpenAI
	err = sendSessionUpdate(ctx, openaiConn)
	if err != nil {
		err = fmt.Errorf("Error sending session update: %v", err)
		return
	}

	var streamSid string
	group, groupCtx := errgroup.WithContext(ctx)
	group.Go(func() (err error) {
		return receiveFromTwilio(groupCtx, wsConn, openaiConn, &streamSid)
	})
	group.Go(func() (err error) {
		return sendToTwilio(groupCtx, wsConn, openaiConn, &streamSid)
	})
	return group.Wait()
}

// receiveFromTwilio receives audio data from Twilio and sends it to the OpenAI Realtime API.
func receiveFromTwilio(ctx context.Context, twilioConn *websocket.Conn, openaiConn *websocket.Conn, streamSid *string) (err error) {
	defer func() {
		if openaiConn != nil {
			openaiConn.Close()
		}
	}()

	for {
		select {
		case <-ctx.Done():
			err = fmt.Errorf("receiveFromTwilio context canceled")
			return
		default:
			var messageBytes []byte
			_, messageBytes, err = twilioConn.ReadMessage()
			if err != nil {
				return fmt.Errorf("Reading message: %v", err)
			}
			var data map[string]interface{}
			err = json.Unmarshal(messageBytes, &data)
			if err != nil {
				log.Println("Error unmarshaling message from Twilio:", err)
				continue
			}
			eventType, _ := data["event"].(string)
			if eventType == "media" && openaiConn != nil {
				media, ok := data["media"].(map[string]interface{})
				if !ok {
					continue
				}
				audioAppendBytes, _ := json.Marshal(openai.RealtimeClientEventInputAudioBufferAppend{
					Audio: media["payload"].(string),
					Type:  "input_audio_buffer.append",
				})
				err = openaiConn.WriteMessage(websocket.TextMessage, audioAppendBytes)
				if err != nil {
					err = fmt.Errorf("Error sending to OpenAI WebSocket: %v", err)
					return
				}
			} else if eventType == "start" {
				startData, ok := data["start"].(map[string]interface{})
				if !ok {
					continue
				}
				*streamSid, _ = startData["streamSid"].(string)
				log.Printf("Incoming stream has started %s", *streamSid)
			}
		}
	}
}

type RealtimeUnknownServerEventResponse struct {
	Type string
}

type RealtimeServerEventResponse struct {
	value any
}

func (r *RealtimeServerEventResponse) UnmarshalJSON(b []byte) (err error) {
	var unknown RealtimeUnknownServerEventResponse
	if err = json.Unmarshal(b, &unknown); err != nil {
		return
	}

	switch unknown.Type {
	case "session.updated":
		var v *openai.RealtimeServerEventSessionUpdated
		err = json.Unmarshal(b, &v)
		r.value = v
	case "response.audio.delta":
		var v *openai.RealtimeServerEventResponseAudioDelta
		err = json.Unmarshal(b, &v)
		r.value = v
	case "response.done":
		var v *openai.RealtimeServerEventResponseDone
		err = json.Unmarshal(b, &v)
		r.value = v
	case "response.audio_transcript.done":
		var v *openai.RealtimeServerEventResponseAudioTranscriptDone
		err = json.Unmarshal(b, &v)
		r.value = v
	case "response.output_item.done":
		var v *openai.RealtimeServerEventResponseOutputItemDone
		err = json.Unmarshal(b, &v)
		r.value = v
		if err != nil {
			return
		}

		if v.Item.Type != nil && *v.Item.Type == "function_call" {
			var v2 ToolCall
			err = json.Unmarshal(b, &v2)
			r.value = v2
		}
	case "response.function_call_arguments.done":
		var v *openai.RealtimeServerEventResponseFunctionCallArgumentsDone
		err = json.Unmarshal(b, &v)
		r.value = v
	default:
		r.value = &unknown
	}

	return
}

// pretend response type because FunctionCallArgumentsDone doesn't
// have a correct schema type yet.
type ToolCall struct {
	Item struct {
		Name      string
		Arguments string
	}
}

// sendToTwilio receives events from the OpenAI Realtime API and sends audio back to Twilio.
func sendToTwilio(ctx context.Context, wsConn *websocket.Conn, openaiConn *websocket.Conn, streamSid *string) (err error) {
	ctx, cancel := context.WithCancelCause(ctx)
	for {
		// cancellation for this call.
		select {
		case <-ctx.Done():
			err = context.Cause(ctx)
			return
		default:
			var messageBytes []byte
			_, messageBytes, err = openaiConn.ReadMessage()
			if err != nil {
				err = fmt.Errorf("Error reading from OpenAI WebSocket: %v", err)
				return
			}
			var response RealtimeServerEventResponse
			err = json.Unmarshal(messageBytes, &response)
			if err != nil {
				log.Println("Error unmarshaling message from OpenAI:", err)
				continue
			}
			switch v := response.value.(type) {
			case *openai.RealtimeServerEventResponseAudioDelta:
				if v.Delta == "" {
					continue
				}

				var decodedData []byte
				decodedData, err = base64.StdEncoding.DecodeString(v.Delta)
				if err != nil {
					log.Println("Error decoding delta audio data:", err)
					continue
				}

				encodedData := base64.StdEncoding.EncodeToString(decodedData)
				audioDelta := map[string]interface{}{
					"event":     "media",
					"streamSid": *streamSid,
					"media": map[string]interface{}{
						"payload": encodedData,
					},
				}
				audioDeltaBytes, _ := json.Marshal(audioDelta)
				err = wsConn.WriteMessage(websocket.TextMessage, audioDeltaBytes)
				if err != nil {
					err = fmt.Errorf("Error sending to Twilio WebSocket: %v", err)
					return
				}
			case ToolCall:
				// model called a function
				fmt.Printf("%+v", v)
				if v.Item.Name == "HangUp" {
					cancel(fmt.Errorf("Model hung up the call: %v", io.EOF))
				}
			case *openai.RealtimeServerEventResponseAudioTranscriptDone:
				log.Println(v.Transcript)
			case *openai.RealtimeServerEventSessionUpdated:
			case *openai.RealtimeServerEventResponseFunctionCallArgumentsDone:
			case *openai.RealtimeServerEventResponseDone:
			case *RealtimeUnknownServerEventResponse:
				log.Println("Unhandled event", v.Type)
			default:
				fmt.Printf("Unhandled type: %+T\n", v)
			}
		}
	}
}

type Session struct{}

type SessionUpdate struct {
	// must be session.update
	Type string
}

func strPtr(s string) *string {
	return &s
}

// sendSessionUpdate sends a session update to the OpenAI WebSocket.
func sendSessionUpdate(ctx context.Context, openaiConn *websocket.Conn) error {
	var temperature float32 = 0.8
	s := openai.RealtimeClientEventSessionUpdate{
		Type: "session.update",
		Session: struct {
			InputAudioFormat        *string "json:\"input_audio_format,omitempty\""
			InputAudioTranscription *struct {
				Model *string "json:\"model,omitempty\""
			} "json:\"input_audio_transcription,omitempty\""
			Instructions      *string                                                          "json:\"instructions,omitempty\""
			MaxOutputTokens   *openai.RealtimeClientEventSessionUpdate_Session_MaxOutputTokens "json:\"max_output_tokens,omitempty\""
			Modalities        *[]string                                                        "json:\"modalities,omitempty\""
			OutputAudioFormat *string                                                          "json:\"output_audio_format,omitempty\""
			Temperature       *float32                                                         "json:\"temperature,omitempty\""
			ToolChoice        *string                                                          "json:\"tool_choice,omitempty\""
			Tools             *[]struct {
				Description *string                 "json:\"description,omitempty\""
				Name        *string                 "json:\"name,omitempty\""
				Parameters  *map[string]interface{} "json:\"parameters,omitempty\""
				Type        *string                 "json:\"type,omitempty\""
			} "json:\"tools,omitempty\""
			TurnDetection *struct {
				PrefixPaddingMs   *int     "json:\"prefix_padding_ms,omitempty\""
				SilenceDurationMs *int     "json:\"silence_duration_ms,omitempty\""
				Threshold         *float32 "json:\"threshold,omitempty\""
				Type              *string  "json:\"type,omitempty\""
			} "json:\"turn_detection,omitempty\""
			Voice *string "json:\"voice,omitempty\""
		}{
			TurnDetection: &struct {
				PrefixPaddingMs   *int     "json:\"prefix_padding_ms,omitempty\""
				SilenceDurationMs *int     "json:\"silence_duration_ms,omitempty\""
				Threshold         *float32 "json:\"threshold,omitempty\""
				Type              *string  "json:\"type,omitempty\""
			}{
				Type: strPtr("server_vad"),
			},
			InputAudioFormat:  strPtr("g711_ulaw"),
			OutputAudioFormat: strPtr("g711_ulaw"),
			Voice:             strPtr(string(openai.CreateSpeechRequestVoiceAlloy)),
			Instructions:      strPtr("Hi"),
			Modalities:        &[]string{"text", "audio"},
			Temperature:       &temperature,
			Tools: &[]struct {
				Description *string                 "json:\"description,omitempty\""
				Name        *string                 "json:\"name,omitempty\""
				Parameters  *map[string]interface{} "json:\"parameters,omitempty\""
				Type        *string                 "json:\"type,omitempty\""
			}{
				{
					Description: strPtr("Used to hang up the call."),
					Name:        strPtr("HangUp"),
					Type:        strPtr("function"),
				},
			},
		},
	}

	sessionUpdateBytes, err := json.Marshal(s)
	if err != nil {
		return err
	}
	fmt.Println(string(sessionUpdateBytes))
	log.Println("Sending session update:", string(sessionUpdateBytes))
	err = openaiConn.WriteMessage(websocket.TextMessage, sessionUpdateBytes)
	if err != nil {
		return err
	}
	return nil
}
