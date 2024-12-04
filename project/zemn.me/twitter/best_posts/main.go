package main

import (
	"bufio"
	"encoding/json"
	"errors"
	"fmt"
	"os"
	"strconv"

	"github.com/zemn-me/monorepo/go/twitter"
)

type Tweet struct {
	twitter.Root
}

type IndexFile struct {
	filepath string
	data     map[int64]string
}

func (i IndexFile) String() string {
	return i.filepath
}

func (i *IndexFile) Set(filePath string) (err error) {
	i.filepath = filePath

	f, err := os.Open(filePath)
	if err != nil {
		return
	}

	defer f.Close()

	if err = json.NewDecoder(f).Decode(&i.data); err != nil {
		return
	}

	return
}

// favCount returns the favourite count as an integer or an error if parsing fails.
func (t Tweet) favCount() (int64, error) {
	return strconv.ParseInt(t.Tweet.FavoriteCount, 10, 64)
}

// rtCount returns the retweet count as an integer or an error if parsing fails.
func (t Tweet) rtCount() (int64, error) {
	return strconv.ParseInt(t.Tweet.RetweetCount, 10, 64)
}

// Score calculates the engagement score for the tweet.
func (t Tweet) Score() (float64, error) {
	favs, err := t.favCount()
	if err != nil {
		return 0, fmt.Errorf("failed to parse favourite count: %w", err)
	}
	rts, err := t.rtCount()
	if err != nil {
		return 0, fmt.Errorf("failed to parse retweet count: %w", err)
	}

	const likeWeight = 1.0
	const retweetWeight = 2.0
	return likeWeight*float64(favs) + retweetWeight*float64(rts), nil
}

// LoadTweetFromFile loads a single tweet from a given file path.
func LoadTweetFromFile(filePath string) (Tweet, error) {
	file, err := os.Open(filePath)
	if err != nil {
		return Tweet{}, fmt.Errorf("failed to open tweet file %s: %w", filePath, err)
	}
	defer file.Close()

	var tweet Tweet
	if err := json.NewDecoder(file).Decode(&tweet); err != nil {
		return Tweet{}, fmt.Errorf("failed to decode tweet JSON in file %s: %w", filePath, err)
	}

	return tweet, nil
}

// LoadTweetFilePaths reads the index file and returns a channel of file paths.
func LoadTweetFilePaths(indexFilePath string) (<-chan string, error) {
	file, err := os.Open(indexFilePath)
	if err != nil {
		return nil, fmt.Errorf("failed to open index file: %w", err)
	}

	paths := make(chan string)

	go func() {
		defer file.Close()
		defer close(paths)

		scanner := bufio.NewScanner(file)
		for scanner.Scan() {
			paths <- scanner.Text()
		}
	}()

	return paths, nil
}

// Do processes tweets listed in the index file and computes scores for each.
func Do(indexFilePath string) error {
	if indexFilePath == "" {
		return errors.New("index file path is not set")
	}

	paths, err := LoadTweetFilePaths(indexFilePath)
	if err != nil {
		return fmt.Errorf("failed to load tweet file paths: %w", err)
	}

	for path := range paths {
		tweet, err := LoadTweetFromFile(path)
		if err != nil {
			return fmt.Errorf("error loading tweet from file %s: %w", path, err)
		}

		score, err := tweet.Score()
		if err != nil {
			return fmt.Errorf("error calculating score for tweet in file %s: %w", path, err)
		}

		fmt.Printf("File: %s, Score: %.2f\n", path, score)
	}

	return nil
}

func main() {
	// Replace with your actual index file path
	const indexFilePath = "tweet_index.txt"

	if err := Do(indexFilePath); err != nil {
		fmt.Fprintf(os.Stderr, "Error: %v\n", err)
		os.Exit(1)
	}
}
