package main

import (
	"bufio"
	"encoding/json"
	"fmt"
	"os"
	"strings"

	"github.com/zemn-me/monorepo/go/twitter"
)

type Tweet struct {
	twitter.Root
}

// ExtractTweetID reads a tweet JSON file and extracts the Tweet ID.
func ExtractTweetID(filePath string) (string, error) {
	file, err := os.Open(filePath)
	if err != nil {
		return "", fmt.Errorf("failed to open tweet file %s: %w", filePath, err)
	}
	defer file.Close()

	var tweet Tweet
	if err := json.NewDecoder(file).Decode(&tweet); err != nil {
		return "", fmt.Errorf("failed to decode tweet JSON in file %s: %w", filePath, err)
	}

	return tweet.Tweet.ID, nil
}

// CreateMapping creates a mapping of Tweet IDs to file paths.
func CreateMapping(indexFilePath string, outputFilePath string) error {
	indexFile, err := os.Open(indexFilePath)
	if err != nil {
		return fmt.Errorf("failed to open index file: %w", err)
	}
	defer indexFile.Close()

	outputFile, err := os.Create(outputFilePath)
	if err != nil {
		return fmt.Errorf("failed to create output file: %w", err)
	}
	defer outputFile.Close()

	writer := bufio.NewWriter(outputFile)
	defer writer.Flush()

	scanner := bufio.NewScanner(indexFile)
	for scanner.Scan() {
		filePath := strings.TrimSpace(scanner.Text())
		tweetID, err := ExtractTweetID(filePath)
		if err != nil {
			return fmt.Errorf("error extracting Tweet ID from file %s: %w", filePath, err)
		}

		// Write the mapping: Tweet ID -> file path
		_, err = fmt.Fprintf(writer, "%s\t%s\n", tweetID, filePath)
		if err != nil {
			return fmt.Errorf("failed to write mapping to output file: %w", err)
		}
	}

	if err := scanner.Err(); err != nil {
		return fmt.Errorf("error reading index file: %w", err)
	}

	return nil
}

func main() {
	// Replace these with your actual file paths
	const indexFilePath = "tweet_index.txt"
	const outputFilePath = "tweet_id_to_path_map.txt"

	if err := CreateMapping(indexFilePath, outputFilePath); err != nil {
		fmt.Fprintf(os.Stderr, "Error: %v\n", err)
		os.Exit(1)
	}

	fmt.Printf("Mapping created successfully: %s\n", outputFilePath)
}
