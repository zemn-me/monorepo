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
	"sync"

	"github.com/gorilla/websocket"
	"github.com/twilio/twilio-go/twiml"
)

var (
	openaiAPIKey  string
	systemMessage = `Hi`
	voice         = "alloy"
	upgrader      = websocket.Upgrader{
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
		twiml.VoiceSay{
			Message: "hi",
		},

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
	var wg sync.WaitGroup
	wg.Add(2)
	go func() {
		defer wg.Done()
		receiveFromTwilio(ctx, wsConn, openaiConn, &streamSid)
	}()
	go func() {
		defer wg.Done()
		sendToTwilio(ctx, wsConn, openaiConn, &streamSid)
	}()
	wg.Wait()

	return
}

// receiveFromTwilio receives audio data from Twilio and sends it to the OpenAI Realtime API.
func receiveFromTwilio(ctx context.Context, wsConn *websocket.Conn, openaiConn *websocket.Conn, streamSid *string) {
	defer func() {
		if openaiConn != nil {
			openaiConn.Close()
		}
	}()

	for {
		select {
		case <-ctx.Done():
			log.Println("receiveFromTwilio context canceled")
			return
		default:
			_, messageBytes, err := wsConn.ReadMessage()
			if err != nil {
				if websocket.IsCloseError(err, websocket.CloseNormalClosure) {
					log.Println("Client disconnected")
				} else {
					log.Println("Error reading from Twilio WebSocket:", err)
				}
				return
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
				payload, _ := media["payload"].(string)
				audioAppend := map[string]interface{}{
					"type":  "input_audio_buffer.append",
					"audio": payload,
				}
				audioAppendBytes, _ := json.Marshal(audioAppend)
				err = openaiConn.WriteMessage(websocket.TextMessage, audioAppendBytes)
				if err != nil {
					log.Println("Error sending to OpenAI WebSocket:", err)
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

// sendToTwilio receives events from the OpenAI Realtime API and sends audio back to Twilio.
func sendToTwilio(ctx context.Context, wsConn *websocket.Conn, openaiConn *websocket.Conn, streamSid *string) {
	for {
		select {
		case <-ctx.Done():
			log.Println("sendToTwilio context canceled")
			return
		default:
			_, messageBytes, err := openaiConn.ReadMessage()
			if err != nil {
				log.Println("Error reading from OpenAI WebSocket:", err)
				return
			}
			var response map[string]interface{}
			err = json.Unmarshal(messageBytes, &response)
			if err != nil {
				log.Println("Error unmarshaling message from OpenAI:", err)
				continue
			}
			responseType, _ := response["type"].(string)
			switch responseType {
			case "session.updated":
				log.Println("Session updated successfully:", response)
			case "response.audio.delta":
				delta, ok := response["delta"].(string)
				if !ok || delta == "" {
					continue
				}
				// Process audio data
				decodedData, err := base64.StdEncoding.DecodeString(delta)
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
					log.Println("Error sending to Twilio WebSocket:", err)
					return
				}
			default:
				log.Printf("Received event: %s %v", responseType, response)
			}
		}
	}
}

// sendSessionUpdate sends a session update to the OpenAI WebSocket.
func sendSessionUpdate(ctx context.Context, openaiConn *websocket.Conn) error {
	sessionUpdate := map[string]interface{}{
		"type": "session.update",
		"session": map[string]interface{}{
			"turn_detection": map[string]interface{}{
				"type": "server_vad",
			},
			"input_audio_format":  "g711_ulaw",
			"output_audio_format": "g711_ulaw",
			"voice":               voice,
			"instructions":        systemMessage,
			"modalities":          []string{"text", "audio"},
			"temperature":         0.8,
		},
	}
	sessionUpdateBytes, err := json.Marshal(sessionUpdate)
	if err != nil {
		return err
	}
	log.Println("Sending session update:", string(sessionUpdateBytes))
	err = openaiConn.WriteMessage(websocket.TextMessage, sessionUpdateBytes)
	if err != nil {
		return err
	}
	return nil
}
