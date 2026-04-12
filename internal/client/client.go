package client

import (
	"bufio"
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"net/url"
	"strings"
	"time"
)

// Client is the Exa API HTTP client.
type Client struct {
	apiKey  string
	baseURL string
	http    *http.Client
}

// New creates a new Exa API client with the given API key.
func New(apiKey string) *Client {
	return &Client{
		apiKey:  apiKey,
		baseURL: "https://api.exa.ai",
		http:    &http.Client{Timeout: 120 * time.Second},
	}
}

// ---------------------------------------------------------------------------
// Request body structs (unexported)
// ---------------------------------------------------------------------------

type searchRequest struct {
	Query              string   `json:"query"`
	NumResults         int      `json:"numResults,omitempty"`
	Type               string   `json:"type,omitempty"`
	IncludeDomains     []string `json:"includeDomains,omitempty"`
	ExcludeDomains     []string `json:"excludeDomains,omitempty"`
	Category           string   `json:"category,omitempty"`
	StartPublishedDate string   `json:"startPublishedDate,omitempty"`
	EndPublishedDate   string   `json:"endPublishedDate,omitempty"`
	UseAutoprompt      bool     `json:"useAutoprompt,omitempty"`
	Text               bool     `json:"text,omitempty"`
	Highlights         bool     `json:"highlights,omitempty"`
	Summary            bool     `json:"summary,omitempty"`
}

type findSimilarRequest struct {
	URL                 string `json:"url"`
	NumResults          int    `json:"numResults,omitempty"`
	ExcludeSourceDomain bool   `json:"excludeSourceDomain,omitempty"`
	Category            string `json:"category,omitempty"`
	Text                bool   `json:"text,omitempty"`
	Highlights          bool   `json:"highlights,omitempty"`
	Summary             bool   `json:"summary,omitempty"`
}

type contentsRequest struct {
	URLs        []string `json:"urls"`
	Text        bool     `json:"text,omitempty"`
	Highlights  bool     `json:"highlights,omitempty"`
	Summary     bool     `json:"summary,omitempty"`
	MaxAgeHours int      `json:"maxAgeHours,omitempty"`
}

type answerRequest struct {
	Query        string `json:"query"`
	Text         bool   `json:"text,omitempty"`
	Model        string `json:"model,omitempty"`
	SystemPrompt string `json:"systemPrompt,omitempty"`
	Stream       bool   `json:"stream,omitempty"`
}

type researchCreateRequest struct {
	Instructions string `json:"instructions"`
	Model        string `json:"model,omitempty"`
}

type codeContextRequest struct {
	Query     string `json:"query"`
	TokensNum any    `json:"tokensNum,omitempty"`
}

// ---------------------------------------------------------------------------
// Option types (exported)
// ---------------------------------------------------------------------------

// SearchOptions configures a Search request.
type SearchOptions struct {
	NumResults     int
	Type           string
	IncludeDomains []string
	ExcludeDomains []string
	Category       string
	StartDate      string
	EndDate        string
	UseAutoprompt  bool
	Text           bool
	Highlights     bool
	Summary        bool
}

// FindSimilarOptions configures a FindSimilar request.
type FindSimilarOptions struct {
	NumResults          int
	ExcludeSourceDomain bool
	Category            string
	Text                bool
	Highlights          bool
	Summary             bool
}

// ContentsOptions configures a GetContents request.
type ContentsOptions struct {
	Text        bool
	Highlights  bool
	Summary     bool
	MaxAgeHours int
}

// AnswerOptions configures an Answer or StreamAnswer request.
type AnswerOptions struct {
	Text         bool
	Model        string
	SystemPrompt string
}

// CodeContextOptions configures a CodeContext request.
type CodeContextOptions struct {
	TokensNum any // "dynamic" | 1000 | 5000 | 50000
}

// ResearchCreateOptions configures a ResearchCreate request.
type ResearchCreateOptions struct {
	Model string // "exa-research-fast", "exa-research", "exa-research-pro"
}

// ResearchListOptions configures a ResearchList request.
type ResearchListOptions struct {
	Limit  int
	Cursor string
}

// ---------------------------------------------------------------------------
// Response types (exported)
// ---------------------------------------------------------------------------

// SearchResponse is returned by Search, FindSimilar, and GetContents.
type SearchResponse struct {
	RequestID   string         `json:"requestId"`
	CostDollars CostDollars    `json:"costDollars"`
	Results     []SearchResult `json:"results"`
}

// CostDollars represents the cost of an API call.
type CostDollars struct {
	Total float64 `json:"total"`
}

// SearchResult is a single result from a search or content request.
type SearchResult struct {
	ID              string    `json:"id"`
	URL             string    `json:"url"`
	Title           string    `json:"title"`
	PublishedDate   string    `json:"publishedDate"`
	Author          string    `json:"author"`
	Score           float64   `json:"score"`
	Text            string    `json:"text"`
	Highlights      []string  `json:"highlights"`
	HighlightScores []float64 `json:"highlightScores"`
	Summary         string    `json:"summary"`
}

// AnswerResponse is returned by Answer.
type AnswerResponse struct {
	RequestID   string      `json:"requestId"`
	CostDollars CostDollars `json:"costDollars"`
	Answer      string      `json:"answer"`
	Citations   []Citation  `json:"citations"`
}

// AnswerChunk is a single SSE chunk from StreamAnswer.
type AnswerChunk struct {
	Content   string     `json:"content"`
	Citations []Citation `json:"citations"`
}

// Citation represents a source reference.
type Citation struct {
	URL   string `json:"url"`
	Title string `json:"title"`
}

// ResearchTask represents an async research task.
type ResearchTask struct {
	ResearchID   string              `json:"researchId"`
	Status       string              `json:"status"`
	Instructions string              `json:"instructions"`
	CostDollars  ResearchCostDollars `json:"costDollars"`
	Output       *ResearchOutput     `json:"output"`
	Citations    []Citation          `json:"citations"`
	Events       []ResearchEvent     `json:"events"`
}

// ResearchCostDollars contains cost breakdown for a research task.
type ResearchCostDollars struct {
	Total           float64 `json:"total"`
	NumSearches     int     `json:"numSearches"`
	NumPages        int     `json:"numPages"`
	ReasoningTokens int     `json:"reasoningTokens"`
}

// ResearchOutput contains the output of a completed research task.
type ResearchOutput struct {
	Parsed  any    `json:"parsed"`
	Content string `json:"content"`
}

// ResearchEvent represents an event in a research task's lifecycle.
type ResearchEvent struct {
	CreatedAt int64  `json:"createdAt"`
	EventType string `json:"eventType"`
	Message   string `json:"message"`
}

// CodeContextResponse is returned by CodeContext.
type CodeContextResponse struct {
	RequestID string `json:"requestId"`
	Query     string `json:"query"`
	Response  string `json:"response"`
}

// ResearchListResponse is returned by ResearchList.
type ResearchListResponse struct {
	Data       []ResearchTask `json:"data"`
	HasMore    bool           `json:"hasMore"`
	NextCursor string         `json:"nextCursor"`
}

// ---------------------------------------------------------------------------
// HTTP helpers
// ---------------------------------------------------------------------------

// post sends a POST request with a JSON body and decodes the response into out.
func (c *Client) post(path string, body any, out any) error {
	data, err := json.Marshal(body)
	if err != nil {
		return fmt.Errorf("marshaling request body: %w", err)
	}

	req, err := http.NewRequest("POST", c.baseURL+path, bytes.NewReader(data))
	if err != nil {
		return fmt.Errorf("creating request: %w", err)
	}
	req.Header.Set("x-api-key", c.apiKey)
	req.Header.Set("Content-Type", "application/json")

	resp, err := c.http.Do(req)
	if err != nil {
		return fmt.Errorf("sending request: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode < 200 || resp.StatusCode >= 300 {
		respBody, _ := io.ReadAll(resp.Body)
		return fmt.Errorf("exa api error %d: %s", resp.StatusCode, string(respBody))
	}

	return json.NewDecoder(resp.Body).Decode(out)
}

// get sends a GET request and decodes the response JSON into out.
// params may be nil if no query parameters are needed.
func (c *Client) get(path string, params url.Values, out any) error {
	u := c.baseURL + path
	if len(params) > 0 {
		u += "?" + params.Encode()
	}

	req, err := http.NewRequest("GET", u, nil)
	if err != nil {
		return fmt.Errorf("creating request: %w", err)
	}
	req.Header.Set("x-api-key", c.apiKey)
	req.Header.Set("Accept", "application/json")

	resp, err := c.http.Do(req)
	if err != nil {
		return fmt.Errorf("sending request: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode < 200 || resp.StatusCode >= 300 {
		respBody, _ := io.ReadAll(resp.Body)
		return fmt.Errorf("exa api error %d: %s", resp.StatusCode, string(respBody))
	}

	return json.NewDecoder(resp.Body).Decode(out)
}

// ---------------------------------------------------------------------------
// API methods
// ---------------------------------------------------------------------------

// Search performs a semantic or keyword search via the Exa API.
func (c *Client) Search(query string, opts SearchOptions) (*SearchResponse, error) {
	body := searchRequest{
		Query:              query,
		NumResults:         opts.NumResults,
		Type:               opts.Type,
		IncludeDomains:     opts.IncludeDomains,
		ExcludeDomains:     opts.ExcludeDomains,
		Category:           opts.Category,
		StartPublishedDate: opts.StartDate,
		EndPublishedDate:   opts.EndDate,
		UseAutoprompt:      opts.UseAutoprompt,
		Text:               opts.Text,
		Highlights:         opts.Highlights,
		Summary:            opts.Summary,
	}

	var resp SearchResponse
	if err := c.post("/search", body, &resp); err != nil {
		return nil, err
	}
	return &resp, nil
}

// FindSimilar finds pages similar to the given URL.
func (c *Client) FindSimilar(u string, opts FindSimilarOptions) (*SearchResponse, error) {
	body := findSimilarRequest{
		URL:                 u,
		NumResults:          opts.NumResults,
		ExcludeSourceDomain: opts.ExcludeSourceDomain,
		Category:            opts.Category,
		Text:                opts.Text,
		Highlights:          opts.Highlights,
		Summary:             opts.Summary,
	}

	var resp SearchResponse
	if err := c.post("/findSimilar", body, &resp); err != nil {
		return nil, err
	}
	return &resp, nil
}

// GetContents extracts content from the given URLs.
func (c *Client) GetContents(urls []string, opts ContentsOptions) (*SearchResponse, error) {
	body := contentsRequest{
		URLs:        urls,
		Text:        opts.Text,
		Highlights:  opts.Highlights,
		Summary:     opts.Summary,
		MaxAgeHours: opts.MaxAgeHours,
	}

	var resp SearchResponse
	if err := c.post("/contents", body, &resp); err != nil {
		return nil, err
	}
	return &resp, nil
}

// Answer gets an AI-generated answer with citations.
func (c *Client) Answer(query string, opts AnswerOptions) (*AnswerResponse, error) {
	body := answerRequest{
		Query:        query,
		Text:         opts.Text,
		Model:        opts.Model,
		SystemPrompt: opts.SystemPrompt,
	}

	var resp AnswerResponse
	if err := c.post("/answer", body, &resp); err != nil {
		return nil, err
	}
	return &resp, nil
}

// StreamAnswer streams an AI-generated answer via SSE. The handler is called
// for each parsed chunk. The provided context controls cancellation; there is
// no per-request timeout so the stream can remain open as long as needed.
func (c *Client) StreamAnswer(ctx context.Context, query string, opts AnswerOptions, handler func(AnswerChunk)) error {
	body := answerRequest{
		Query:        query,
		Text:         opts.Text,
		Model:        opts.Model,
		SystemPrompt: opts.SystemPrompt,
		Stream:       true,
	}

	data, err := json.Marshal(body)
	if err != nil {
		return fmt.Errorf("marshaling request body: %w", err)
	}

	req, err := http.NewRequestWithContext(ctx, "POST", c.baseURL+"/answer", bytes.NewReader(data))
	if err != nil {
		return fmt.Errorf("creating request: %w", err)
	}
	req.Header.Set("x-api-key", c.apiKey)
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Accept", "text/event-stream")

	// Use a client with no timeout for streaming — cancellation is handled
	// by the context passed into the request.
	streamClient := &http.Client{
		Transport: c.http.Transport,
	}
	resp, err := streamClient.Do(req)
	if err != nil {
		return fmt.Errorf("sending request: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode < 200 || resp.StatusCode >= 300 {
		respBody, _ := io.ReadAll(resp.Body)
		return fmt.Errorf("exa api error %d: %s", resp.StatusCode, string(respBody))
	}

	scanner := bufio.NewScanner(resp.Body)
	for scanner.Scan() {
		line := scanner.Text()

		if !strings.HasPrefix(line, "data:") {
			continue
		}

		payload := strings.TrimPrefix(line, "data:")
		payload = strings.TrimSpace(payload)

		if payload == "[DONE]" {
			break
		}

		var chunk AnswerChunk
		if err := json.Unmarshal([]byte(payload), &chunk); err != nil {
			// Skip malformed chunks rather than aborting the stream.
			continue
		}

		handler(chunk)
	}

	if err := scanner.Err(); err != nil {
		return fmt.Errorf("reading SSE stream: %w", err)
	}

	return nil
}

// ResearchCreate starts a new research task.
func (c *Client) ResearchCreate(instructions string, opts ResearchCreateOptions) (*ResearchTask, error) {
	body := researchCreateRequest{
		Instructions: instructions,
		Model:        opts.Model,
	}

	var resp ResearchTask
	if err := c.post("/research", body, &resp); err != nil {
		return nil, err
	}
	return &resp, nil
}

// ResearchGet retrieves the current state of a research task. If events is
// true the response includes the task's event log.
func (c *Client) ResearchGet(id string, events bool) (*ResearchTask, error) {
	params := url.Values{}
	if events {
		params.Set("events", "true")
	}

	var resp ResearchTask
	if err := c.get("/research/"+id, params, &resp); err != nil {
		return nil, err
	}
	return &resp, nil
}

// ResearchList lists research tasks with optional pagination.
func (c *Client) ResearchList(opts ResearchListOptions) (*ResearchListResponse, error) {
	params := url.Values{}
	if opts.Limit > 0 {
		params.Set("limit", fmt.Sprintf("%d", opts.Limit))
	}
	if opts.Cursor != "" {
		params.Set("cursor", opts.Cursor)
	}

	var resp ResearchListResponse
	if err := c.get("/research", params, &resp); err != nil {
		return nil, err
	}
	return &resp, nil
}

// CodeContext retrieves code context for the given query using the Exa Code API.
func (c *Client) CodeContext(query string, opts CodeContextOptions) (*CodeContextResponse, error) {
	body := codeContextRequest{
		Query:     query,
		TokensNum: opts.TokensNum,
	}

	var resp CodeContextResponse
	if err := c.post("/context", body, &resp); err != nil {
		return nil, err
	}
	return &resp, nil
}

// ResearchPollUntilFinished polls a research task until it reaches a terminal
// state or the timeout elapses.
//
// pollIntervalMs defaults to 1000 if zero. timeoutMs defaults to 300000 (5
// minutes) if zero.
func (c *Client) ResearchPollUntilFinished(id string, pollIntervalMs, timeoutMs int) (*ResearchTask, error) {
	if pollIntervalMs <= 0 {
		pollIntervalMs = 1000
	}
	if timeoutMs <= 0 {
		timeoutMs = 300000
	}

	interval := time.Duration(pollIntervalMs) * time.Millisecond
	deadline := time.Now().Add(time.Duration(timeoutMs) * time.Millisecond)

	for {
		task, err := c.ResearchGet(id, true)
		if err != nil {
			return nil, fmt.Errorf("polling research task %s: %w", id, err)
		}

		if task.Status != "processing" {
			return task, nil
		}

		if time.Now().After(deadline) {
			return nil, fmt.Errorf("timeout waiting for research task %s after %dms", id, timeoutMs)
		}

		time.Sleep(interval)
	}
}
