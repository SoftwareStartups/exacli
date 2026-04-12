package utils

import (
	"reflect"
	"testing"
)

func TestParseNumber(t *testing.T) {
	cases := []struct {
		name   string
		input  string
		wantN  int
		wantOK bool
	}{
		{"positive integer", "42", 42, true},
		{"zero", "0", 0, true},
		{"negative integer", "-10", -10, true},
		{"empty string", "", 0, false},
		{"non-numeric", "abc", 0, false},
		{"float", "3.14", 0, false},
		{"whitespace only", "  ", 0, false},
	}

	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			n, ok := ParseNumber(tc.input)
			if n != tc.wantN || ok != tc.wantOK {
				t.Errorf("ParseNumber(%q) = (%d, %t), want (%d, %t)", tc.input, n, ok, tc.wantN, tc.wantOK)
			}
		})
	}
}

func TestParseStringList(t *testing.T) {
	cases := []struct {
		name  string
		input string
		want  []string
	}{
		{"simple list", "a,b,c", []string{"a", "b", "c"}},
		{"with whitespace", "  a  ,  b  ", []string{"a", "b"}},
		{"single item", "single", []string{"single"}},
		{"empty segments", "a,,b", []string{"a", "b"}},
		{"all empty segments", ",,,", nil},
		{"empty string", "", nil},
	}

	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			got := ParseStringList(tc.input)
			if !reflect.DeepEqual(got, tc.want) {
				t.Errorf("ParseStringList(%q) = %v, want %v", tc.input, got, tc.want)
			}
		})
	}
}

func TestIsValidURL(t *testing.T) {
	cases := []struct {
		name  string
		input string
		want  bool
	}{
		{"https URL", "https://example.com", true},
		{"http localhost", "http://localhost:3000", true},
		{"https with path and query", "https://example.com/path?query=value", true},
		{"ftp scheme", "ftp://files.example.com", false},
		{"no scheme", "not-a-url", false},
		{"empty string", "", false},
		{"bare domain", "example.com", false},
	}

	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			got := IsValidURL(tc.input)
			if got != tc.want {
				t.Errorf("IsValidURL(%q) = %t, want %t", tc.input, got, tc.want)
			}
		})
	}
}

func TestIsValidSearchType(t *testing.T) {
	validTypes := []string{"auto", "neural", "keyword", "hybrid", "fast", "instant", "deep", "deep-lite", "deep-reasoning"}
	for _, st := range validTypes {
		t.Run("valid_"+st, func(t *testing.T) {
			if !IsValidSearchType(st) {
				t.Errorf("IsValidSearchType(%q) = false, want true", st)
			}
		})
	}

	invalidTypes := []string{"invalid", ""}
	for _, st := range invalidTypes {
		name := st
		if name == "" {
			name = "empty"
		}
		t.Run("invalid_"+name, func(t *testing.T) {
			if IsValidSearchType(st) {
				t.Errorf("IsValidSearchType(%q) = true, want false", st)
			}
		})
	}
}

func TestIsValidAnswerModel(t *testing.T) {
	cases := []struct {
		name  string
		input string
		want  bool
	}{
		{"exa", "exa", true},
		{"exa-pro", "exa-pro", true},
		{"gpt4", "gpt4", false},
		{"empty", "", false},
	}

	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			got := IsValidAnswerModel(tc.input)
			if got != tc.want {
				t.Errorf("IsValidAnswerModel(%q) = %t, want %t", tc.input, got, tc.want)
			}
		})
	}
}

func TestIsValidResearchModel(t *testing.T) {
	cases := []struct {
		name  string
		input string
		want  bool
	}{
		{"fast", "fast", true},
		{"regular", "regular", true},
		{"pro", "pro", true},
		{"slow", "slow", false},
		{"empty", "", false},
	}

	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			got := IsValidResearchModel(tc.input)
			if got != tc.want {
				t.Errorf("IsValidResearchModel(%q) = %t, want %t", tc.input, got, tc.want)
			}
		})
	}
}
