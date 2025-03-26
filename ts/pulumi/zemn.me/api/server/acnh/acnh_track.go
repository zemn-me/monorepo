package acnh

import (
	"fmt"
	"time"
)

// FileNameByTrackNumber maps track numbers to filenames.
var FileNameByTrackNumber = map[string]string{
	"1-01": "1-01. 1 a.m. (~Sunny Weather~).mp3",
	"1-16": "1-16. 4 a.m. (~Rainy Weather~).mp3",
	"1-31": "1-31. 7 a.m. (~Snowy Weather~).mp3",
	"2-10": "2-10. 10 p.m. (~Sunny Weather~).mp3",
	"2-25": "2-25. 1 p.m. (~Snowy Weather~).mp3",
	"1-02": "1-02. 2 a.m. (~Sunny Weather~).mp3",
	"1-17": "1-17. 5 a.m. (~Rainy Weather~).mp3",
	"1-32": "1-32. 8 a.m. (~Snowy Weather~).mp3",
	"2-11": "2-11. 11 p.m. (~Sunny Weather~).mp3",
	"2-26": "2-26. 2 p.m. (~Snowy Weather~).mp3",
	"1-03": "1-03. 3 a.m. (~Sunny Weather~).mp3",
	"1-18": "1-18. 6 a.m. (~Rainy Weather~).mp3",
	"1-33": "1-33. 9 a.m. (~Snowy Weather~).mp3",
	"2-12": "2-12. Midnight (~Sunny Weather~).mp3",
	"2-27": "2-27. 3 p.m. (~Snowy Weather~).mp3",
	"1-04": "1-04. 4 a.m. (~Sunny Weather~).mp3",
	"1-19": "1-19. 7 a.m. (~Rainy Weather~).mp3",
	"1-34": "1-34. 10 a.m. (~Snowy Weather~).mp3",
	"2-13": "2-13. 1 p.m. (~Rainy Weather~).mp3",
	"2-28": "2-28. 4 p.m. (~Snowy Weather~).mp3",
	"1-05": "1-05. 5 a.m. (~Sunny Weather~).mp3",
	"1-20": "1-20. 8 a.m. (~Rainy Weather~).mp3",
	"1-35": "1-35. 11 a.m. (~Snowy Weather~).mp3",
	"2-14": "2-14. 2 p.m. (~Rainy Weather~).mp3",
	"2-29": "2-29. 5 p.m. (~Snowy Weather~).mp3",
	"1-06": "1-06. 6 a.m. (~Sunny Weather~).mp3",
	"1-21": "1-21. 9 a.m. (~Rainy Weather~).mp3",
	"1-36": "1-36 Noon (~Snowy Weather~).mp3",
	"2-15": "2-15. 3 p.m. (~Rainy Weather~).mp3",
	"2-30": "2-30. 6 p.m. (~Snowy Weather~).mp3",
	"1-07": "1-07. 7 a.m. (~Sunny Weather~).mp3",
	"1-22": "1-22. 10 a.m. (~Rainy Weather~).mp3",
	"2-01": "2-01. 1 p.m. (~Sunny Weather~).mp3",
	"2-16": "2-16. 4 p.m. (~Rainy Weather~).mp3",
	"2-31": "2-31. 7 p.m. (~Snowy Weather~).mp3",
	"1-08": "1-08. 8 a.m. (~Sunny Weather~).mp3",
	"1-23": "1-23. 11 a.m. (~Rainy Weather~).mp3",
	"2-02": "2-02. 2 p.m. (~Sunny Weather~).mp3",
	"2-17": "2-17. 5 p.m. (~Rainy Weather~).mp3",
	"2-32": "2-32. 8 p.m. (~Snowy Weather~).mp3",
	"1-09": "1-09. 9 a.m. (~Sunny Weather~).mp3",
	"1-24": "1-24 Noon (~Rainy Weather~).mp3",
	"2-03": "2-03. 3 p.m. (~Sunny Weather~).mp3",
	"2-18": "2-18. 6 p.m. (~Rainy Weather~).mp3",
	"2-33": "2-33. 9 p.m. (~Snowy Weather~).mp3",
	"1-10": "1-10. 10 a.m. (~Sunny Weather~).mp3",
	"1-25": "1-25. 1 a.m. (~Snowy Weather~).mp3",
	"2-04": "2-04. 4 p.m. (~Sunny Weather~).mp3",
	"2-19": "2-19. 7 a.m. (~Rainy Weather~).mp3",
	"2-34": "2-34. 10 p.m. (~Snowy Weather~).mp3",
	"1-11": "1-11. 11 a.m. (~Sunny Weather~).mp3",
	"1-26": "1-26. 2 a.m. (~Snowy Weather~).mp3",
	"2-05": "2-05. 5 p.m. (~Sunny Weather~).mp3",
	"2-20": "2-20. 8 p.m. (~Rainy Weather~).mp3",
	"2-35": "2-35. 11 p.m. (~Snowy Weather~).mp3",
	"1-12": "1-12 Noon (~Sunny Weather~).mp3",
	"1-27": "1-27. 3 a.m. (~Snowy Weather~).mp3",
	"2-06": "2-06. 6 p.m. (~Sunny Weather~).mp3",
	"2-21": "2-21. 9 p.m. (~Rainy Weather~).mp3",
	"2-36": "2-36 Midnight (~Snowy Weather~).mp3",
	"1-13": "1-13. 1 a.m. (~Rainy Weather~).mp3",
	"1-28": "1-28. 4 a.m. (~Snowy Weather~).mp3",
	"2-07": "2-07. 7 p.m. (~Sunny Weather~).mp3",
	"2-22": "2-22. 10 p.m. (~Rainy Weather~).mp3",
	"1-14": "1-14. 2 a.m. (~Rainy Weather~).mp3",
	"1-29": "1-29. 5 a.m. (~Snowy Weather~).mp3",
	"2-08": "2-08. 8 p.m. (~Sunny Weather~).mp3",
	"2-23": "2-23. 11 p.m. (~Rainy Weather~).mp3",
	"1-15": "1-15. 3 a.m. (~Rainy Weather~).mp3",
	"1-30": "1-30. 6 a.m. (~Snowy Weather~).mp3",
	"2-09": "2-09. 9 p.m. (~Sunny Weather~).mp3",
	"2-24": "2-24 Midnight (~Rainy Weather~).mp3",
}

// Weather type and constants.
type Weather string

const (
	Sunny Weather = "sunny"
	Rainy Weather = "rainy"
	Snowy Weather = "snowy"
)

// BackingTrackMap holds the mapping from weather and time (formatted as "15:04") to a backing track number.
var BackingTrackMap = map[Weather]map[string]string{
	Sunny: {
		"00:00": "2-12",
		"01:00": "1-01",
		"02:00": "1-02",
		"03:00": "1-03",
		"04:00": "1-04",
		"05:00": "1-05",
		"06:00": "1-06",
		"07:00": "1-07",
		"08:00": "1-08",
		"09:00": "1-09",
		"10:00": "1-10",
		"11:00": "1-11",
		"12:00": "1-12",
		"13:00": "2-01",
		"14:00": "2-02",
		"15:00": "2-03",
		"16:00": "2-04",
		"17:00": "2-05",
		"18:00": "2-06",
		"19:00": "2-07",
		"20:00": "2-08",
		"21:00": "2-09",
		"22:00": "2-10",
		"23:00": "2-11",
	},
	Rainy: {
		"00:00": "2-24",
		"01:00": "1-13",
		"02:00": "1-14",
		"03:00": "1-15",
		"04:00": "1-16",
		"05:00": "1-17",
		"06:00": "1-18",
		"07:00": "1-19",
		"08:00": "1-20",
		"09:00": "1-21",
		"10:00": "1-22",
		"11:00": "1-23",
		"12:00": "1-24",
		"13:00": "2-13",
		"14:00": "2-14",
		"15:00": "2-15",
		"16:00": "2-16",
		"17:00": "2-17",
		"18:00": "2-18",
		"19:00": "2-19",
		"20:00": "2-20",
		"21:00": "2-21",
		"22:00": "2-22",
		"23:00": "2-23",
	},
	Snowy: {
		"00:00": "2-36",
		"01:00": "1-25",
		"02:00": "1-26",
		"03:00": "1-27",
		"04:00": "1-28",
		"05:00": "1-29",
		"06:00": "1-30",
		"07:00": "1-31",
		"08:00": "1-32",
		"09:00": "1-33",
		"10:00": "1-34",
		"11:00": "1-35",
		"12:00": "1-36",
		"13:00": "2-25",
		"14:00": "2-26",
		"15:00": "2-27",
		"16:00": "2-28",
		"17:00": "2-29",
		"18:00": "2-30",
		"19:00": "2-31",
		"20:00": "2-32",
		"21:00": "2-33",
		"22:00": "2-34",
		"23:00": "2-35",
	},
}

func Track(w Weather, t time.Time) (string, error) {
	// Truncate to the hour.
	truncatedTime := t.Truncate(time.Hour)
	timeStr := truncatedTime.Format("15:04")

	weatherMap, ok := BackingTrackMap[w]
	if !ok {
		return "", fmt.Errorf("unsupported weather: %s", w)
	}

	trackNumber, ok := weatherMap[timeStr]
	if !ok {
		return "", fmt.Errorf("unsupported time: %s", timeStr)
	}

	fileName, ok := FileNameByTrackNumber[trackNumber]
	if !ok {
		return "", fmt.Errorf("file name not found for track number: %s", trackNumber)
	}
	return fileName, nil
}
