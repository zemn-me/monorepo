package realtime

import (
	"context"
	"encoding/json"
	"net/http"
	"net/url"

	"github.com/gorilla/websocket"
	jsonschema "github.com/santhosh-tekuri/jsonschema/v5"

	"github.com/zemn-me/monorepo/go/openai"
)

var endpoint *url.URL

func init() {
	var err error
	endpoint, err = url.Parse("wss://api.openai.com/v1/realtime")
	if err != nil {
		panic(err)
	}
}

type Conn struct {
	ws *websocket.Conn
}

type Dialer struct {
	Model string
	openai.Auth
}

func (d Dialer) url() (target url.URL) {
	target = *endpoint
	target.Query().Add("model", d.Model)

	return
}

func (d Dialer) Headers() (h http.Header) {
	h = d.Auth.Headers().Clone()
	h.Add("OpenAI-Beta", "realtime=v1")
	return
}

// Connect to the OpenAI realtime API.
//
// If the connection fails for whatever reason, err will be non-nil,
// and rsp will be a non-nil HTTP response.
func (d Dialer) Dial(ctx context.Context) (c Conn, rsp *http.Response, err error) {
	target := d.url()
	c.ws, rsp, err = websocket.DefaultDialer.DialContext(ctx, target.String(), d.Headers())

	return
}

type Message interface {
	json.Marshaler
	isValidMessage()
}

type MessageType string

const (
	MessageTypeCreate        MessageType = "response.create"
	MessageTypeUpdateSession MessageType = "session.update"
)

type Modality string

const (
	ModalityText  Modality = "text"
	ModalityAudio Modality = "audio"
)

const (
	VoiceAlloy = "alloy"
)

type AudioFormat string

const (
	AudioFormatPCM16    AudioFormat = "pcm16"
	AudioFormatG711Ulaw AudioFormat = "g711_ulaw"
	AudioFormatG711Alaw AudioFormat = "g711_alaw"
)

const (
	TranscriptionModelWhisper1 = "whisper-1"
)

type TurnDetectionType string

const (
	TurnDetectionTypeVad TurnDetectionType = "server_vad"
)

type ToolType string

const (
	ToolTypeFunction ToolType = "function"
)

type ToolChoice string

const (
	ToolChoiceAuto     ToolChoice = "auto"
	ToolChoiceNone     ToolChoice = "none"
	ToolChoiceRequired ToolChoice = "required"
)

type SessionUpdate struct {
	Modalities              []Modality
	Instructions            string
	Voice                   string
	InputAudioFormat        AudioFormat `json:"input_audio_format"`
	OutputAudioFormat       AudioFormat `json:"output_audio_format"`
	InputAudioTranscription *struct {
		Enabled bool
		Model   string
	} `json:"input_audio_transcription"`

	TurnDetection *struct {
		Type              TurnDetectionType
		Threshold         float64
		PrefixPaddingMs   int32 `json:"prefix_padding_ms"`
		SilenceDurationMs int32 `json:"silence_duration_ms"`
	} `json:"turn_detection"`

	Tools *struct {
		Type        ToolType
		Name        string
		description string
		// jsonschema params. must be an object (I think).
		parameters jsonschema.Schema
	}

	ToolChoice      ToolChoice `json:"tool_choice"`
	Temperature     int
	MaxOutputTokens int
}

// keep going https://platform.openai.com/docs/api-reference/realtime-client-events/session-update
