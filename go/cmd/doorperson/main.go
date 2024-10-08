package main

import (
	"encoding/json"
	"flag"
	"fmt"
	"io"
	"net/http"
	"net/url"
	"os"
	"strings"
	"time"

	"github.com/gorilla/websocket"
)

// WeatherData represents the response structure for weather API
type WeatherData struct {
	Weather []struct {
		Description string `json:"description"`
	} `json:"weather"`
	Main struct {
		Temp float64 `json:"temp"`
	} `json:"main"`
}

// Response represents the structure for handling WebSocket messages
type Response struct {
	Type    string        `json:"type"`
	Content []ContentItem `json:"content"`
}

// ContentItem represents an item in the content of a response
type ContentItem struct {
	Type string `json:"type"`
	Text string `json:"text"`
}

var baseWeatherURL = url.URL{
	Scheme: "http",
	Host:   "api.openweathermap.org",
	Path:   "/data/2.5/weather",
}

func getWeather(location, weatherAPIKey string) (weatherData WeatherData, err error) {
	// Clone base URL
	urlObj := baseWeatherURL

	// Set query parameters
	query := url.Values{}
	query.Set("q", location)
	query.Set("appid", weatherAPIKey)
	urlObj.RawQuery = query.Encode()

	// Make the request
	resp, err := http.Get(urlObj.String())
	if err != nil {
		err = fmt.Errorf("retrieving weather data: %w", err)
		return
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		return "Unable to retrieve weather data."
	}

	var weatherData WeatherData
	err = json.NewDecoder(resp.Body).Decode(&weatherData)
	if err != nil {
		err = fmt.Errorf("parsing weather data: %w", err)
		return
	}

	return
}

func getTimeOfDay() string {
	hour := time.Now().Hour()
	switch {
	case hour >= 6 && hour < 12:
		return "morning"
	case hour >= 12 && hour < 18:
		return "afternoon"
	default:
		return "evening"
	}
}

func startWebSocketConnection(apiKey string) {
	// Build WebSocket URL
	wsURL, err := url.Parse("wss://api.openai.com/v1/realtime")
	if err != nil {
		fmt.Println("building WebSocket URL:", err)
		return
	}

	// Add query parameters
	params := url.Values{}
	params.Add("model", "gpt-4o-realtime-preview-2024-10-01")
	wsURL.RawQuery = params.Encode()

	// Set headers
	headers := http.Header{
		"Authorization": []string{fmt.Sprintf("Bearer %s", apiKey)},
		"OpenAI-Beta":   []string{"realtime=v1"},
	}

	conn, _, err := websocket.DefaultDialer.Dial(wsURL.String(), headers)
	if err != nil {
		fmt.Println("connecting to WebSocket:", err)
		return
	}
	defer conn.Close()

	greeting := struct {
		Type string `json:"type"`
		Item struct {
			Type    string `json:"type"`
			Role    string `json:"role"`
			Content []struct {
				Type string `json:"type"`
				Text string `json:"text"`
			} `json:"content"`
		} `json:"item"`
	}{
		Type: "conversation.item.create",
	}
	greeting.Item.Type = "message"
	greeting.Item.Role = "user"
	greeting.Item.Content = []struct {
		Type string `json:"type"`
		Text string `json:"text"`
	}{{Type: "input_text", Text: "Hello, please assist me."}}

	greetingMessage, err := json.Marshal(greeting)
	if err != nil {
		fmt.Println("marshaling greeting message:", err)
		return
	}

	err = conn.WriteMessage(websocket.TextMessage, greetingMessage)
	if err != nil {
		fmt.Println("sending greeting message:", err)
		return
	}

	for {
		_, messageBytes, err := conn.ReadMessage()
		if err != nil {
			fmt.Println("reading message:", err)
			break
		}
		handleMessage(strings.NewReader(string(messageBytes)))
	}
}

func handleMessage(message io.Reader) {
	var response Response
	err := json.NewDecoder(message).Decode(&response)
	if err != nil {
		fmt.Println("unmarshaling message:", err)
		return
	}

	for _, contentItem := range response.Content {
		if contentItem.Type == "input_text" {
			fmt.Println("Assistant says:", contentItem.Text)
			if strings.Contains(strings.ToLower(contentItem.Text), "password correct") {
				playDTMF9()
			}
		}
	}
}

func playDTMF9() {
	fmt.Println("Playing DTMF tone 9 for 3 seconds, three times")
	for i := 0; i < 3; i++ {
		// Generate and play a DTMF tone (using placeholder print statements here)
		fmt.Println("Beep - DTMF 9")
		time.Sleep(3 * time.Second)
	}
}

func main() {
	// Parse command-line arguments
	var openaiAPIKey string
	flag.StringVar(&openaiAPIKey, "openai_api_key", "", "Your OpenAI API key.")
	var location string
	flag.StringVar(&location, "location", "", "Location for weather information.")
	var weatherAPIKey string
	flag.StringVar(&weatherAPIKey, "weather_api_key", "", "Your Weather API key.")
	flag.Parse()

	if openaiAPIKey == "" || location == "" || weatherAPIKey == "" {
		fmt.Println("Usage: go run main.go --openai_api_key=<OPENAI_API_KEY> --location=<LOCATION> --weather_api_key=<WEATHER_API_KEY>")
		os.Exit(1)
	}

	// Get location-specific data
	timeOfDay := getTimeOfDay()
	weatherData, err := getWeather(*location, *weatherAPIKey)
	if err != nil {
		fmt.Println(err)
		os.Exit(1)
	}
	tempC := weatherData.Main.Temp - 273.15
	weather := fmt.Sprintf("Weather in %s: %s, Temp: %.2f°C", *location, weatherData.Weather[0].Description, tempC)

	// Print greeting message
	greetingMessage := fmt.Sprintf("Good %s, the current weather is: %s", timeOfDay, weather)
	fmt.Println(greetingMessage)

	// Start WebSocket connection for real-time interaction
	startWebSocketConnection(*openaiAPIKey)
}
