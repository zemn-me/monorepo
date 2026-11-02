// Package main provides functionality to create a mapping between Tweet IDs and their respective file paths.
package main

import (
	"bufio"
	"encoding/json"
	"flag"
	"fmt"
	"os"
	"strconv"
	"strings"

	"github.com/zemn-me/monorepo/go/twitter" // Replace with the actual path of your twitter package
)

// Tweet wraps the Root structure from the twitter package.
type Tweet struct {
	twitter.Root
}

// ExtractTweetID reads a JSON file containing a Tweet and extracts its ID.
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

	return tweet.Tweet.Id, nil
}

// CreateMapping generates a mapping of Tweet IDs to file paths from an index file.
func CreateMapping(indexFilePath, outputFilePath string) error {
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

	m := make(map[int64]string, 80000)

	scanner := bufio.NewScanner(indexFile)
	for scanner.Scan() {
		filePath := strings.TrimSpace(scanner.Text())
		tweetID, err := ExtractTweetID(filePath)
		if err != nil {
			return fmt.Errorf("error extracting Tweet ID from file %s: %w", filePath, err)
		}

		id, err := strconv.ParseInt(tweetID, 10, 64)
		if err != nil {
			return fmt.Errorf("can't parse tweet id in %+q: %v", filePath, err)
		}

		m[id] = filePath
	}

	if err := scanner.Err(); err != nil {
		return fmt.Errorf("error reading index file: %w", err)
	}

	enc := json.NewEncoder(writer)
	enc.SetIndent("", "\t")

	if err := enc.Encode(m); err != nil {
		return err
	}

	return nil
}

// main is the entry point of the program.
func main() {
	// Define flags
	indexFilePath := flag.String("index", "", "Path to the index file containing Tweet JSON file paths (required)")
	outputFilePath := flag.String("output", "", "Path to the output file for storing Tweet ID mappings (required)")
	flag.Parse()

	// Validate flags
	if *indexFilePath == "" || *outputFilePath == "" {
		fmt.Fprintln(os.Stderr, "Error: Both -index and -output flags are required.")
		flag.Usage()
		os.Exit(1)
	}

	// Generate the mapping and handle errors
	if err := CreateMapping(*indexFilePath, *outputFilePath); err != nil {
		fmt.Fprintf(os.Stderr, "Error: %v\n", err)
		os.Exit(1)
	}
}
