package main

import (
	"encoding/json"
	"flag"
	"fmt"
	"os"
	"strconv"

	"github.com/bazelbuild/rules_go/go/runfiles"

	"github.com/zemn-me/monorepo/go/twitter"
)

type Tweet struct {
	twitter.Root
}

type IndexFile struct {
	filepath string
	data     map[string]string // Keys are strings (tweet IDs) and values are file paths
}

var _ flag.Value = &IndexFile{}

func (i IndexFile) String() string {
	return i.filepath
}

func (i *IndexFile) Set(filePath string) error {
	i.filepath = filePath
	i.data = make(map[string]string)

	f, err := os.Open(filePath)
	if err != nil {
		return fmt.Errorf("failed to open file %s: %w", filePath, err)
	}
	defer f.Close()

	if err = json.NewDecoder(f).Decode(&i.data); err != nil {
		return fmt.Errorf("failed to decode JSON in file %s: %w", filePath, err)
	}

	return nil
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

		// Decode JSON from the index file (map of tweet IDs to file paths)
		var indexData map[string]string
		if err := json.NewDecoder(file).Decode(&indexData); err != nil {
			fmt.Fprintf(os.Stderr, "Error reading index file: %v\n", err)
			return
		}

		// Send the file paths to the channel
		for _, path := range indexData {
			paths <- path
		}
	}()

	return paths, nil
}

// Do processes tweets listed in the index file and computes scores for each.
func Do() error {
	indexFilePath := indexFile.filepath
	paths, err := LoadTweetFilePaths(indexFilePath)
	if err != nil {
		return fmt.Errorf("failed to load tweet file paths: %w", err)
	}

	type data struct {
		Score float64
		File  string
	}

	var d []data

	for path := range paths {
		absPath, err := runfiles.Rlocation(
			"_main/" + path,
		)
		if err != nil {
			return err
		}
		tweet, err := LoadTweetFromFile(absPath)
		if err != nil {
			return fmt.Errorf("error loading tweet from file %s: %w", path, err)
		}

		score, err := tweet.Score()
		if err != nil {
			return fmt.Errorf("error calculating score for tweet in file %s: %w", path, err)
		}

		if score < 100 {
			continue
		}

		d = append(d, data{Score: score, File: path})
	}

	f, err := os.Create(out)
	if err != nil {
		return err
	}

	enc := json.NewEncoder(f)
	enc.SetIndent("", "\t")

	err = enc.Encode(d)
	if err != nil {
		return err
	}

	return nil
}

var (
	indexFile IndexFile
	out       string
)

func init() {
	flag.Var(&indexFile, "index", "JSON file mapping tweet IDs to filepaths.")
	flag.StringVar(&out, "out", "", "File to put top tweets in.")
}

func main() {
	flag.Parse()
	if err := Do(); err != nil {
		fmt.Fprintf(os.Stderr, "Error: %v\n", err)
		os.Exit(1)
	}
}
