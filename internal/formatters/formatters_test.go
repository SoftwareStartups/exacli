package formatters

import (
	"encoding/json"
	"errors"
	"strings"
	"testing"

	"github.com/wesbragagt/exacli/internal/client"
)

// ---------------------------------------------------------------------------
// FormatSearchResults
// ---------------------------------------------------------------------------

func TestFormatSearchResults(t *testing.T) {
	resp := &client.SearchResponse{
		RequestID:   "req-123",
		CostDollars: client.CostDollars{Total: 0.0025},
		Results: []client.SearchResult{
			{
				Title:           "Example Page",
				URL:             "https://example.com",
				ID:              "id-1",
				PublishedDate:   "2024-01-15",
				Author:          "Alice",
				Score:           0.95,
				Text:            "Some content here.",
				Highlights:      []string{"highlighted text"},
				HighlightScores: []float64{0.87},
				Summary:         "A brief summary.",
			},
		},
	}

	t.Run("json mode", func(t *testing.T) {
		out := FormatSearchResults(resp, true, false)
		var parsed map[string]any
		if err := json.Unmarshal([]byte(out), &parsed); err != nil {
			t.Fatalf("JSON output is not valid JSON: %v", err)
		}
		if !strings.Contains(out, "req-123") {
			t.Error("JSON output missing requestId")
		}
		if !strings.Contains(out, "Example Page") {
			t.Error("JSON output missing result title")
		}
	})

	t.Run("toon mode", func(t *testing.T) {
		out := FormatSearchResults(resp, false, true)
		if !strings.Contains(out, "requestId: req-123") {
			t.Errorf("TOON output missing requestId line, got:\n%s", out)
		}
		if !strings.Contains(out, "results.0.url: https://example.com") {
			t.Errorf("TOON output missing results.0.url line, got:\n%s", out)
		}
	})

	t.Run("markdown mode", func(t *testing.T) {
		out := FormatSearchResults(resp, false, false)
		for _, want := range []string{
			"# Search Results",
			"Example Page",
			"https://example.com",
			"Request ID: req-123",
		} {
			if !strings.Contains(out, want) {
				t.Errorf("markdown output missing %q", want)
			}
		}
	})

	t.Run("empty results", func(t *testing.T) {
		empty := &client.SearchResponse{
			CostDollars: client.CostDollars{Total: 0},
		}
		out := FormatSearchResults(empty, false, false)
		if !strings.Contains(out, "# Search Results") {
			t.Error("empty results missing header")
		}
	})
}

// ---------------------------------------------------------------------------
// FormatAnswerResponse
// ---------------------------------------------------------------------------

func TestFormatAnswerResponse(t *testing.T) {
	resp := &client.AnswerResponse{
		RequestID:   "ans-456",
		CostDollars: client.CostDollars{Total: 0.005},
		Answer:      "The answer is 42.",
		Citations: []client.Citation{
			{Title: "Deep Thought", URL: "https://example.com/42"},
		},
	}

	t.Run("markdown with citations", func(t *testing.T) {
		out := FormatAnswerResponse(resp, false, false)
		for _, want := range []string{
			"# Answer",
			"The answer is 42.",
			"## Citations",
			"[Deep Thought](https://example.com/42)",
		} {
			if !strings.Contains(out, want) {
				t.Errorf("markdown output missing %q", want)
			}
		}
	})

	t.Run("json mode", func(t *testing.T) {
		out := FormatAnswerResponse(resp, true, false)
		var parsed map[string]any
		if err := json.Unmarshal([]byte(out), &parsed); err != nil {
			t.Fatalf("JSON output is not valid JSON: %v", err)
		}
		if !strings.Contains(out, "The answer is 42.") {
			t.Error("JSON output missing answer text")
		}
	})

	t.Run("no citations", func(t *testing.T) {
		noCitations := &client.AnswerResponse{
			RequestID:   "ans-789",
			CostDollars: client.CostDollars{Total: 0.001},
			Answer:      "No sources needed.",
		}
		out := FormatAnswerResponse(noCitations, false, false)
		if strings.Contains(out, "## Citations") {
			t.Error("output should not contain Citations section when there are none")
		}
	})
}

// ---------------------------------------------------------------------------
// FormatResearchTask
// ---------------------------------------------------------------------------

func TestFormatResearchTask(t *testing.T) {
	task := &client.ResearchTask{
		ResearchID:   "res-001",
		Status:       "completed",
		Instructions: "Analyze market trends",
		CostDollars: client.ResearchCostDollars{
			Total:           0.15,
			NumSearches:     5,
			NumPages:        20,
			ReasoningTokens: 1500,
		},
		Output: &client.ResearchOutput{
			Content: "Market analysis complete.",
		},
		Citations: []client.Citation{
			{Title: "Market Report", URL: "https://example.com/report"},
		},
		Events: []client.ResearchEvent{
			{
				CreatedAt: 1700000000000, // 2023-11-14T22:13:20Z
				EventType: "search",
				Message:   "Searching for trends",
			},
		},
	}

	t.Run("markdown full", func(t *testing.T) {
		out := FormatResearchTask(task, false, false)
		for _, want := range []string{
			"# Research Task",
			"res-001",
			"completed",
			"## Output",
			"Market analysis complete.",
			"## Events",
			"search",
			"Searching for trends",
		} {
			if !strings.Contains(out, want) {
				t.Errorf("markdown output missing %q, got:\n%s", want, out)
			}
		}
	})

	t.Run("with output content", func(t *testing.T) {
		out := FormatResearchTask(task, false, false)
		if !strings.Contains(out, "## Output") {
			t.Error("missing Output section")
		}
		if !strings.Contains(out, "Market analysis complete.") {
			t.Error("missing output content")
		}
	})

	t.Run("nil output", func(t *testing.T) {
		noOutput := &client.ResearchTask{
			ResearchID: "res-002",
			Status:     "processing",
			CostDollars: client.ResearchCostDollars{
				Total: 0.01,
			},
		}
		out := FormatResearchTask(noOutput, false, false)
		if strings.Contains(out, "## Output") {
			t.Error("should not contain Output section when output is nil")
		}
	})

	t.Run("events with timestamp", func(t *testing.T) {
		out := FormatResearchTask(task, false, false)
		// Timestamp should be formatted as RFC3339 in UTC
		if !strings.Contains(out, "2023-11-14T22:13:20Z") {
			t.Errorf("missing formatted timestamp in events, got:\n%s", out)
		}
	})
}

// ---------------------------------------------------------------------------
// FormatError
// ---------------------------------------------------------------------------

func TestFormatError(t *testing.T) {
	err := errors.New("something went wrong")

	cases := []struct {
		name   string
		asToon bool
		want   string
	}{
		{"plain", false, "Error: something went wrong\n"},
		{"toon", true, "error: something went wrong\n"},
	}

	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			got := FormatError(err, tc.asToon)
			if got != tc.want {
				t.Errorf("FormatError(%v, %t) = %q, want %q", err, tc.asToon, got, tc.want)
			}
		})
	}
}

// ---------------------------------------------------------------------------
// FormatSuccess
// ---------------------------------------------------------------------------

func TestFormatSuccess(t *testing.T) {
	cases := []struct {
		name   string
		msg    string
		asToon bool
		want   string
	}{
		{"plain", "Task complete", false, "Task complete\n"},
		{"toon", "Task complete", true, "success: Task complete\n"},
	}

	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			got := FormatSuccess(tc.msg, tc.asToon)
			if got != tc.want {
				t.Errorf("FormatSuccess(%q, %t) = %q, want %q", tc.msg, tc.asToon, got, tc.want)
			}
		})
	}
}

// ---------------------------------------------------------------------------
// FormatCodeContextResult
// ---------------------------------------------------------------------------

func TestFormatCodeContextResult(t *testing.T) {
	resp := &client.CodeContextResponse{
		RequestID: "ctx-001",
		Query:     "how to use cobra",
		Response:  "func main() { fmt.Println(\"hello\") }",
	}

	t.Run("markdown mode", func(t *testing.T) {
		out := FormatCodeContextResult(resp, false, false)
		for _, want := range []string{
			"# Code Context",
			"Request ID: ctx-001",
			"Query: how to use cobra",
			"func main()",
		} {
			if !strings.Contains(out, want) {
				t.Errorf("markdown output missing %q, got:\n%s", want, out)
			}
		}
	})

	t.Run("json mode", func(t *testing.T) {
		out := FormatCodeContextResult(resp, true, false)
		var parsed map[string]any
		if err := json.Unmarshal([]byte(out), &parsed); err != nil {
			t.Fatalf("JSON output is not valid JSON: %v", err)
		}
		if !strings.Contains(out, "ctx-001") {
			t.Error("JSON output missing requestId")
		}
	})

	t.Run("toon mode", func(t *testing.T) {
		out := FormatCodeContextResult(resp, false, true)
		if !strings.Contains(out, "requestId: ctx-001") {
			t.Errorf("TOON output missing requestId line, got:\n%s", out)
		}
	})

	t.Run("empty response does not panic", func(t *testing.T) {
		empty := &client.CodeContextResponse{}
		out := FormatCodeContextResult(empty, false, false)
		if !strings.Contains(out, "# Code Context") {
			t.Error("empty response missing header")
		}
	})
}
