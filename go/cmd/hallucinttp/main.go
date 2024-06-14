// Command hallucinhttp is an LLM that thinks it's an HTTP server.
// in some respect, it kind of is.
package main

import (
	"context"
	"errors"
	"flag"
	"io"
	"log"
	"net"
	"sync"

	openai "github.com/sashabaranov/go-openai"
)

var oaiapikey string

func init() {
	flag.StringVar(&oaiapikey, "oaiapikey", "", "Your OpenAI API key.")
}

type Server struct {
	oai          openai.Client
	ln           net.Listener
	messages     *[]openai.ChatCompletionMessage
	messagesLock sync.RWMutex
}

// adds a new message (request) to the server, and returns the full
// history of messages.
func (s *Server) AddAndReturnMessages(m openai.ChatCompletionMessage) []openai.ChatCompletionMessage {
	s.messagesLock.Lock()
	defer s.messagesLock.Unlock()
	if s.messages == nil {
		s.messages = &[]openai.ChatCompletionMessage{}
	}
	*s.messages = append(*s.messages, m)

	c := make([]openai.ChatCompletionMessage, len(*s.messages))
	copy(c, *s.messages)

	return c
}

func (s *Server) Serve(ctx context.Context) (err error) {
	// send the initial message
	_ = s.AddAndReturnMessages(openai.ChatCompletionMessage{
		Role:    openai.ChatMessageRoleSystem,
		Content: "You are an HTTP Server. The messages following will be from your clients.",
	})

	for {
		var conn net.Conn
		conn, err = s.ln.Accept()
		if err != nil {
			return
		}
		go func(ctx context.Context, c net.Conn) {
			log.Printf("Handling request...\n")
			ctx, cancel := context.WithCancelCause(ctx)
			content, err := io.ReadAll(c)
			if err != nil {

				log.Printf("Error: %v\n", err)
				cancel(err)
				return
			}
			rs, err := s.oai.CreateChatCompletion(
				ctx,
				openai.ChatCompletionRequest{
					Model: openai.GPT4,
					Messages: s.AddAndReturnMessages(openai.ChatCompletionMessage{
						Role:    openai.ChatMessageRoleUser,
						Content: string(content),
					}),
				},
			)
			if err != nil {

				log.Printf("Error: %v\n", err)
				cancel(err)
				return
			}
			_, err = c.Write([]byte(rs.Choices[0].Message.Content))
			if err != nil {

				log.Printf("Error: %v\n", err)
				cancel(err)
				return
			}
		}(ctx, conn)
	}
}

func do() (err error) {
	flag.Parse()
	if oaiapikey == "" {
		return errors.New("missing api key --oaiapikey")
	}
	ln, err := net.Listen("tcp", ":http-alt")
	defer ln.Close()
	if err != nil {
		return
	}

	s := Server{
		oai: *openai.NewClient(oaiapikey),
		ln:  ln,
	}

	return s.Serve(context.Background())
}

func main() {
	if err := do(); err != nil {
		panic(err)
	}
}
