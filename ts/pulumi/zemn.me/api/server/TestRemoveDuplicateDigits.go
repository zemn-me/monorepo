package apiserver

import "testing"

func TestRemoveDuplicateDigits(t *testing.T) {
	tests := []struct {
		input    string
		expected string
	}{
		{"112233445566", "123456"},
		{"1111111", "1"},
		{"121212", "121212"},
		{"", ""},
		{"a111b222c", "a1b2c"},
		{"a1b2c3", "a1b2c3"},
		{"1234444555", "12345"},
		{"00aa00", "0aa0"},
	}

	for _, tt := range tests {
		result := removeDuplicateDigits(tt.input)
		if result != tt.expected {
			t.Errorf("removeDuplicateDigits(%q) = %q; expected %q", tt.input, result, tt.expected)
		}
	}
}
