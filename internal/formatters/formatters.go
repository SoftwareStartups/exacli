package formatters

import (
	"encoding/json"
	"fmt"
	"sort"
	"strings"
	"time"

	"github.com/wesbragagt/exacli/internal/client"
)

const (
	costDecimals           = 4
	scoreDecimals          = 3
	highlightScoreDecimals = 2
	instructionPreviewLen  = 60
)

// ---------------------------------------------------------------------------
// FormatSearchResults formats a SearchResponse as markdown, JSON, or TOON.
// ---------------------------------------------------------------------------

func FormatSearchResults(resp *client.SearchResponse, asJSON, asToon bool) string {
	if asJSON {
		return toJSON(resp)
	}
	if asToon {
		return toToon(resp)
	}

	var b strings.Builder
	b.WriteString("# Search Results\n\n")

	if resp.RequestID != "" {
		fmt.Fprintf(&b, "Request ID: %s\n", resp.RequestID)
	}
	fmt.Fprintf(&b, "Cost: $%.*f\n", costDecimals, resp.CostDollars.Total)
	b.WriteString("\n")

	for i, r := range resp.Results {
		fmt.Fprintf(&b, "## %d. %s\n\n", i+1, r.Title)

		if r.URL != "" {
			fmt.Fprintf(&b, "- **URL:** %s\n", r.URL)
		}
		if r.ID != "" {
			fmt.Fprintf(&b, "- **ID:** %s\n", r.ID)
		}
		if r.PublishedDate != "" {
			fmt.Fprintf(&b, "- **Published:** %s\n", r.PublishedDate)
		}
		if r.Author != "" {
			fmt.Fprintf(&b, "- **Author:** %s\n", r.Author)
		}
		if r.Score > 0 {
			fmt.Fprintf(&b, "- **Relevance Score:** %.*f\n", scoreDecimals, r.Score)
		}

		if r.Text != "" {
			b.WriteString("\n### Content\n\n")
			b.WriteString(r.Text)
			b.WriteString("\n")
		}

		if len(r.Highlights) > 0 {
			b.WriteString("\n### Highlights\n\n")
			for j, h := range r.Highlights {
				if j < len(r.HighlightScores) {
					fmt.Fprintf(&b, "- %s (score: %.*f)\n", h, highlightScoreDecimals, r.HighlightScores[j])
				} else {
					fmt.Fprintf(&b, "- %s\n", h)
				}
			}
		}

		if r.Summary != "" {
			b.WriteString("\n### Summary\n\n")
			b.WriteString(r.Summary)
			b.WriteString("\n")
		}

		b.WriteString("\n---\n\n")
	}

	return b.String()
}

// ---------------------------------------------------------------------------
// FormatAnswerResponse formats an AnswerResponse as markdown, JSON, or TOON.
// ---------------------------------------------------------------------------

func FormatAnswerResponse(resp *client.AnswerResponse, asJSON, asToon bool) string {
	if asJSON {
		return toJSON(resp)
	}
	if asToon {
		return toToon(resp)
	}

	var b strings.Builder
	b.WriteString("# Answer\n\n")

	if resp.RequestID != "" {
		fmt.Fprintf(&b, "Request ID: %s\n", resp.RequestID)
	}
	fmt.Fprintf(&b, "Cost: $%.*f\n", costDecimals, resp.CostDollars.Total)
	b.WriteString("\n")

	b.WriteString("## Response\n\n")
	b.WriteString(resp.Answer)
	b.WriteString("\n")

	if len(resp.Citations) > 0 {
		b.WriteString("\n## Citations\n\n")
		for i, c := range resp.Citations {
			fmt.Fprintf(&b, "%d. [%s](%s)\n", i+1, c.Title, c.URL)
		}
	}

	return b.String()
}

// ---------------------------------------------------------------------------
// FormatResearchTask formats a ResearchTask as markdown, JSON, or TOON.
// ---------------------------------------------------------------------------

func FormatResearchTask(task *client.ResearchTask, asJSON, asToon bool) string {
	if asJSON {
		return toJSON(task)
	}
	if asToon {
		return toToon(task)
	}

	var b strings.Builder
	b.WriteString("# Research Task\n\n")

	if task.ResearchID != "" {
		fmt.Fprintf(&b, "- **ID:** %s\n", task.ResearchID)
	}
	if task.Status != "" {
		fmt.Fprintf(&b, "- **Status:** %s\n", task.Status)
	}
	if task.Instructions != "" {
		fmt.Fprintf(&b, "- **Instructions:** %s\n", task.Instructions)
	}

	// Cost line with optional breakdown in parentheses.
	costLine := fmt.Sprintf("$%.*f", costDecimals, task.CostDollars.Total)
	if parts := researchCostParts(task.CostDollars); len(parts) > 0 {
		costLine += " (" + strings.Join(parts, ", ") + ")"
	}
	fmt.Fprintf(&b, "- **Cost:** %s\n", costLine)

	if task.Output != nil && task.Output.Content != "" {
		b.WriteString("\n## Output\n\n")
		b.WriteString(task.Output.Content)
		b.WriteString("\n")
	}

	if len(task.Citations) > 0 {
		b.WriteString("\n## Sources\n\n")
		for i, c := range task.Citations {
			fmt.Fprintf(&b, "%d. [%s](%s)\n", i+1, c.Title, c.URL)
		}
	}

	if len(task.Events) > 0 {
		b.WriteString("\n## Events\n\n")
		for _, e := range task.Events {
			ts := time.UnixMilli(e.CreatedAt).UTC().Format(time.RFC3339)
			fmt.Fprintf(&b, "- [%s] %s: %s\n", ts, e.EventType, e.Message)
		}
	}

	return b.String()
}

// researchCostParts builds the conditional breakdown parts for research costs.
func researchCostParts(c client.ResearchCostDollars) []string {
	var parts []string
	if c.NumSearches > 0 {
		parts = append(parts, fmt.Sprintf("%d searches", c.NumSearches))
	}
	if c.NumPages > 0 {
		parts = append(parts, fmt.Sprintf("%d pages", c.NumPages))
	}
	if c.ReasoningTokens > 0 {
		parts = append(parts, fmt.Sprintf("%d reasoning tokens", c.ReasoningTokens))
	}
	return parts
}

// ---------------------------------------------------------------------------
// FormatResearchList formats a ResearchListResponse as markdown, JSON, or TOON.
// ---------------------------------------------------------------------------

func FormatResearchList(resp *client.ResearchListResponse, asJSON, asToon bool) string {
	if asJSON {
		return toJSON(resp)
	}
	if asToon {
		return toToon(resp)
	}

	var b strings.Builder
	b.WriteString("# Research Tasks\n\n")

	for _, t := range resp.Data {
		instr := t.Instructions
		if len(instr) > instructionPreviewLen {
			instr = instr[:instructionPreviewLen] + "..."
		}
		fmt.Fprintf(&b, "- %s: %s\n  %s\n\n", t.ResearchID, t.Status, instr)
	}

	if resp.HasMore && resp.NextCursor != "" {
		fmt.Fprintf(&b, "More results available. Use --cursor %s to see more.\n", resp.NextCursor)
	}

	return b.String()
}

// ---------------------------------------------------------------------------
// FormatCodeContextResult formats a CodeContextResponse as markdown, JSON, or TOON.
// ---------------------------------------------------------------------------

func FormatCodeContextResult(resp *client.CodeContextResponse, asJSON, asToon bool) string {
	if asJSON {
		return toJSON(resp)
	}
	if asToon {
		return toToon(resp)
	}

	var b strings.Builder
	b.WriteString("# Code Context\n\n")

	if resp.RequestID != "" {
		fmt.Fprintf(&b, "Request ID: %s\n", resp.RequestID)
	}
	if resp.Query != "" {
		fmt.Fprintf(&b, "Query: %s\n", resp.Query)
	}
	b.WriteString("\n")

	b.WriteString(resp.Response)
	b.WriteString("\n")

	return b.String()
}

// ---------------------------------------------------------------------------
// FormatError formats an error message.
// ---------------------------------------------------------------------------

func FormatError(err error, asToon bool) string {
	if asToon {
		return fmt.Sprintf("error: %s\n", err.Error())
	}
	return fmt.Sprintf("Error: %s\n", err.Error())
}

// ---------------------------------------------------------------------------
// FormatSuccess formats a success message.
// ---------------------------------------------------------------------------

func FormatSuccess(message string, asToon bool) string {
	if asToon {
		return fmt.Sprintf("success: %s\n", message)
	}
	return fmt.Sprintf("%s\n", message)
}

// ---------------------------------------------------------------------------
// JSON output helper
// ---------------------------------------------------------------------------

func toJSON(v any) string {
	data, err := json.MarshalIndent(v, "", "  ")
	if err != nil {
		return ""
	}
	return string(data)
}

// ---------------------------------------------------------------------------
// TOON output helpers
// ---------------------------------------------------------------------------

// toToon converts any struct into TOON (key-path flattened) format.
func toToon(v any) string {
	// Marshal to JSON then unmarshal into a generic map to get field names
	// matching JSON tags.
	data, err := json.Marshal(v)
	if err != nil {
		return ""
	}

	var m map[string]any
	if err := json.Unmarshal(data, &m); err != nil {
		return ""
	}

	var lines []string
	flattenMap("", m, &lines)
	return strings.Join(lines, "\n") + "\n"
}

// flattenMap recursively flattens a nested map into "key.path: value" lines.
func flattenMap(prefix string, m map[string]any, lines *[]string) {
	// Sort keys for deterministic output.
	keys := make([]string, 0, len(m))
	for k := range m {
		keys = append(keys, k)
	}
	sort.Strings(keys)

	for _, k := range keys {
		v := m[k]
		fullKey := k
		if prefix != "" {
			fullKey = prefix + "." + k
		}

		flattenValue(fullKey, v, lines)
	}
}

// flattenValue handles a single value which may be a map, slice, or scalar.
func flattenValue(key string, v any, lines *[]string) {
	if v == nil {
		// Skip null values.
		return
	}

	switch val := v.(type) {
	case map[string]any:
		flattenMap(key, val, lines)
	case []any:
		for i, elem := range val {
			elemKey := fmt.Sprintf("%s.%d", key, i)
			flattenValue(elemKey, elem, lines)
		}
	case float64:
		// If the number is a whole number, format without decimals.
		if val == float64(int64(val)) {
			*lines = append(*lines, fmt.Sprintf("%s: %d", key, int64(val)))
		} else {
			*lines = append(*lines, fmt.Sprintf("%s: %f", key, val))
		}
	case bool:
		*lines = append(*lines, fmt.Sprintf("%s: %t", key, val))
	case string:
		*lines = append(*lines, fmt.Sprintf("%s: %s", key, val))
	default:
		*lines = append(*lines, fmt.Sprintf("%s: %v", key, val))
	}
}
