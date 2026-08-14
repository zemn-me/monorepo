package main

import (
	"context"
	"crypto/sha256"
	"errors"
	"fmt"
	"io"
	"log"
	"net/http"
	"net/url"
	"os"
	"path/filepath"
	"strconv"
	"sync"
	"time"

	"github.com/aws/aws-sdk-go-v2/aws/signer/v4"
	"github.com/aws/aws-sdk-go-v2/service/s3"
)

const (
	localJournalObjectPath       = "/__local/journal/object"
	localJournalRefreshPath      = "/__local/journal/refresh"
	localJournalAudioDelayEnv    = "JOURNAL_LOCAL_AUDIO_DELAY_MS"
	localJournalMaxBytes         = 25 * 1024 * 1024
	localJournalMaximumReadDelay = 5 * time.Second
)

type localJournalUploadProcessor func(context.Context, string, string, int64) error

// localJournalStore supplies the S3-shaped interface used by the API while
// keeping development data ephemeral and private to the dev-server process.
type localJournalStore struct {
	baseURL      string
	directory    string
	logger       *log.Logger
	mu           sync.RWMutex
	contentTypes map[string]string
	processor    localJournalUploadProcessor
	readDelay    time.Duration
}

func newLocalJournalStore(baseURL string, logger *log.Logger) (*localJournalStore, error) {
	directory, err := os.MkdirTemp("", "zemn-journal-dev-")
	if err != nil {
		return nil, err
	}
	store := &localJournalStore{
		baseURL: baseURL, directory: directory, logger: logger, contentTypes: map[string]string{},
	}
	if milliseconds, err := strconv.Atoi(os.Getenv(localJournalAudioDelayEnv)); err == nil && milliseconds > 0 {
		store.readDelay = min(time.Duration(milliseconds)*time.Millisecond, localJournalMaximumReadDelay)
	}
	return store, nil
}

func (s *localJournalStore) Close() error {
	return os.RemoveAll(s.directory)
}

func (s *localJournalStore) SetUploadProcessor(processor localJournalUploadProcessor) {
	s.processor = processor
}

func localJournalObjectID(bucket, key string) string {
	return fmt.Sprintf("%x", sha256.Sum256([]byte(bucket+"\x00"+key)))
}

func (s *localJournalStore) objectURL(bucket, key string) string {
	values := url.Values{"bucket": {bucket}, "key": {key}}
	return s.baseURL + localJournalObjectPath + "?" + values.Encode()
}

func (s *localJournalStore) writeObject(bucket, key, contentType string, body io.Reader, overwrite bool) (int64, error) {
	temporary, err := os.CreateTemp(s.directory, ".upload-")
	if err != nil {
		return 0, err
	}
	temporaryName := temporary.Name()
	keep := false
	defer func() {
		_ = temporary.Close()
		if !keep {
			_ = os.Remove(temporaryName)
		}
	}()

	size, err := io.Copy(temporary, body)
	if err != nil {
		return 0, err
	}
	if err := temporary.Close(); err != nil {
		return 0, err
	}

	id := localJournalObjectID(bucket, key)
	destination := filepath.Join(s.directory, id)
	s.mu.Lock()
	defer s.mu.Unlock()
	if !overwrite {
		if _, err := os.Stat(destination); err == nil {
			return 0, os.ErrExist
		} else if !errors.Is(err, os.ErrNotExist) {
			return 0, err
		}
	}
	if err := os.Rename(temporaryName, destination); err != nil {
		return 0, err
	}
	keep = true
	s.contentTypes[id] = contentType
	return size, nil
}

func (s *localJournalStore) PutObject(_ context.Context, input *s3.PutObjectInput, _ ...func(*s3.Options)) (*s3.PutObjectOutput, error) {
	if input.Bucket == nil || input.Key == nil || input.Body == nil {
		return nil, errors.New("bucket, key, and body are required")
	}
	contentType := "application/octet-stream"
	if input.ContentType != nil {
		contentType = *input.ContentType
	}
	if _, err := s.writeObject(*input.Bucket, *input.Key, contentType, input.Body, true); err != nil {
		return nil, err
	}
	return &s3.PutObjectOutput{}, nil
}

func (s *localJournalStore) DeleteObject(_ context.Context, input *s3.DeleteObjectInput, _ ...func(*s3.Options)) (*s3.DeleteObjectOutput, error) {
	if input.Bucket == nil || input.Key == nil {
		return nil, errors.New("bucket and key are required")
	}
	id := localJournalObjectID(*input.Bucket, *input.Key)
	s.mu.Lock()
	defer s.mu.Unlock()
	if err := os.Remove(filepath.Join(s.directory, id)); err != nil && !errors.Is(err, os.ErrNotExist) {
		return nil, err
	}
	delete(s.contentTypes, id)
	return &s3.DeleteObjectOutput{}, nil
}

func (s *localJournalStore) GetObject(_ context.Context, input *s3.GetObjectInput, _ ...func(*s3.Options)) (*s3.GetObjectOutput, error) {
	if input.Bucket == nil || input.Key == nil {
		return nil, errors.New("bucket and key are required")
	}
	id := localJournalObjectID(*input.Bucket, *input.Key)
	s.mu.RLock()
	file, err := os.Open(filepath.Join(s.directory, id))
	contentType := s.contentTypes[id]
	s.mu.RUnlock()
	if err != nil {
		return nil, err
	}
	info, err := file.Stat()
	if err != nil {
		_ = file.Close()
		return nil, err
	}
	length := info.Size()
	return &s3.GetObjectOutput{
		Body: file, ContentLength: &length, ContentType: &contentType,
	}, nil
}

func (s *localJournalStore) PresignPutObject(_ context.Context, input *s3.PutObjectInput, _ ...func(*s3.PresignOptions)) (*v4.PresignedHTTPRequest, error) {
	if input.Bucket == nil || input.Key == nil {
		return nil, errors.New("bucket and key are required")
	}
	headers := http.Header{}
	if input.ContentType != nil {
		headers.Set("Content-Type", *input.ContentType)
	}
	if input.IfNoneMatch != nil {
		headers.Set("If-None-Match", *input.IfNoneMatch)
	}
	return &v4.PresignedHTTPRequest{
		Method: http.MethodPut, URL: s.objectURL(*input.Bucket, *input.Key), SignedHeader: headers,
	}, nil
}

func (s *localJournalStore) PresignGetObject(_ context.Context, input *s3.GetObjectInput, _ ...func(*s3.PresignOptions)) (*v4.PresignedHTTPRequest, error) {
	if input.Bucket == nil || input.Key == nil {
		return nil, errors.New("bucket and key are required")
	}
	objectURL := s.objectURL(*input.Bucket, *input.Key)
	if s.readDelay > 0 {
		objectURL += "&delayMs=" + strconv.FormatInt(s.readDelay.Milliseconds(), 10)
	}
	return &v4.PresignedHTTPRequest{
		Method: http.MethodGet, URL: objectURL, SignedHeader: http.Header{},
	}, nil
}

func (s *localJournalStore) ServeHTTP(response http.ResponseWriter, request *http.Request) {
	response.Header().Set("Access-Control-Allow-Origin", "*")
	response.Header().Set("Access-Control-Allow-Methods", "GET, PUT, OPTIONS")
	response.Header().Set("Access-Control-Allow-Headers", "Content-Type, If-None-Match")
	if request.Method == http.MethodOptions {
		response.WriteHeader(http.StatusNoContent)
		return
	}
	bucket := request.URL.Query().Get("bucket")
	key := request.URL.Query().Get("key")
	if bucket == "" || key == "" {
		http.Error(response, "bucket and key are required", http.StatusBadRequest)
		return
	}
	switch request.Method {
	case http.MethodPut:
		body := http.MaxBytesReader(response, request.Body, localJournalMaxBytes)
		size, err := s.writeObject(bucket, key, request.Header.Get("Content-Type"), body, request.Header.Get("If-None-Match") != "*")
		if errors.Is(err, os.ErrExist) {
			http.Error(response, "object already exists", http.StatusPreconditionFailed)
			return
		}
		if err != nil {
			http.Error(response, err.Error(), http.StatusBadRequest)
			return
		}
		response.WriteHeader(http.StatusNoContent)
		if s.processor != nil {
			go func() {
				ctx, cancel := context.WithTimeout(context.Background(), 10*time.Minute)
				defer cancel()
				if err := s.processor(ctx, bucket, key, size); err != nil {
					s.logger.Printf("process local journal upload %q: %v", key, err)
				}
			}()
		}
	case http.MethodGet:
		if delayMilliseconds, err := strconv.Atoi(request.URL.Query().Get("delayMs")); err == nil && delayMilliseconds > 0 {
			delay := min(time.Duration(delayMilliseconds)*time.Millisecond, localJournalMaximumReadDelay)
			timer := time.NewTimer(delay)
			defer timer.Stop()
			select {
			case <-timer.C:
			case <-request.Context().Done():
				return
			}
		}
		object, err := s.GetObject(request.Context(), &s3.GetObjectInput{Bucket: &bucket, Key: &key})
		if err != nil {
			http.NotFound(response, request)
			return
		}
		defer object.Body.Close()
		if object.ContentType != nil {
			response.Header().Set("Content-Type", *object.ContentType)
		}
		if object.ContentLength != nil {
			response.Header().Set("Content-Length", fmt.Sprint(*object.ContentLength))
		}
		_, _ = io.Copy(response, object.Body)
	default:
		response.Header().Set("Allow", "GET, PUT, OPTIONS")
		http.Error(response, "method not allowed", http.StatusMethodNotAllowed)
	}
}
