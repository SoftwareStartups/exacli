package utils

import (
	"net/url"
	"strconv"
	"strings"
)

var validSearchTypes = map[string]bool{
	"auto": true, "neural": true, "keyword": true, "hybrid": true,
	"fast": true, "instant": true, "deep": true, "deep-lite": true,
	"deep-reasoning": true,
}

var validAnswerModels = map[string]bool{
	"exa": true, "exa-pro": true,
}

var validResearchModels = map[string]bool{
	"fast": true, "regular": true, "pro": true,
}

// ParseNumber parses a string as an integer. Returns 0, false if invalid.
func ParseNumber(s string) (int, bool) {
	s = strings.TrimSpace(s)
	if s == "" {
		return 0, false
	}
	n, err := strconv.Atoi(s)
	return n, err == nil
}

// ParseStringList splits a comma-separated string, trims whitespace, filters empties.
func ParseStringList(s string) []string {
	if s == "" {
		return nil
	}
	parts := strings.Split(s, ",")
	var result []string
	for _, p := range parts {
		p = strings.TrimSpace(p)
		if p != "" {
			result = append(result, p)
		}
	}
	return result
}

// IsValidURL returns true if s is a valid http or https URL.
func IsValidURL(s string) bool {
	u, err := url.Parse(s)
	if err != nil {
		return false
	}
	return u.Scheme == "http" || u.Scheme == "https"
}

// IsValidSearchType returns true if s is a recognized search type.
func IsValidSearchType(s string) bool {
	return validSearchTypes[s]
}

// IsValidAnswerModel returns true if s is a recognized answer model.
func IsValidAnswerModel(s string) bool {
	return validAnswerModels[s]
}

// IsValidResearchModel returns true if s is a recognized research model.
func IsValidResearchModel(s string) bool {
	return validResearchModels[s]
}
