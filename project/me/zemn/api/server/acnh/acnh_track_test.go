package acnh

import (
	"testing"
	"time"
)

func TestACNHBackingTrackByWeatherAndTime(t *testing.T) {
	testCases := []struct {
		name      string
		weather   Weather
		inputTime time.Time
		expected  string
		expectErr bool
	}{
		{
			name:      "Sunny at 22:30 (truncated to 22:00)",
			weather:   Sunny,
			inputTime: time.Date(2023, time.January, 1, 22, 30, 0, 0, time.UTC),
			expected:  "2-10. 10 p.m. (~Sunny Weather~).mp3",
		},
		{
			name:      "Rainy at 01:30 (truncated to 01:00)",
			weather:   Rainy,
			inputTime: time.Date(2023, time.January, 1, 1, 30, 0, 0, time.UTC),
			expected:  "1-13. 1 a.m. (~Rainy Weather~).mp3",
		},
		{
			name:      "Snowy at 23:15 (truncated to 23:00)",
			weather:   Snowy,
			inputTime: time.Date(2023, time.January, 1, 23, 15, 0, 0, time.UTC),
			expected:  "2-35. 11 p.m. (~Snowy Weather~).mp3",
		},
		{
			name:      "Unsupported weather",
			weather:   Weather("windy"),
			inputTime: time.Date(2023, time.January, 1, 12, 0, 0, 0, time.UTC),
			expectErr: true,
		},
	}

	for _, tc := range testCases {
		t.Run(tc.name, func(t *testing.T) {
			got, err := Track(tc.weather, tc.inputTime)
			if tc.expectErr {
				if err == nil {
					t.Errorf("expected an error, but got none")
				}
				return
			}
			if err != nil {
				t.Errorf("unexpected error: %v", err)
			}
			if got != tc.expected {
				t.Errorf("expected %q, but got %q", tc.expected, got)
			}
		})
	}
}
