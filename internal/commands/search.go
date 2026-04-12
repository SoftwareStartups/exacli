package commands

import (
	"fmt"
	"os"
	"strings"

	"github.com/spf13/cobra"
	"github.com/SoftwareStartups/exacli/internal/client"
	"github.com/SoftwareStartups/exacli/internal/formatters"
)

var validSearchTypes = map[string]bool{
	"auto": true, "neural": true, "keyword": true, "hybrid": true,
	"fast": true, "instant": true, "deep": true, "deep-lite": true,
	"deep-reasoning": true,
}

var searchCmd = &cobra.Command{
	Use:   "search <query>",
	Short: "Search the web using Exa",
	Args:  cobra.MinimumNArgs(1),
	RunE: func(cmd *cobra.Command, args []string) error {
		query := strings.Join(args, " ")

		// Get global flags
		asJSON, _ := cmd.Flags().GetBool("json")
		asToon, _ := cmd.Flags().GetBool("toon")

		// Get search flags
		numResults, _ := cmd.Flags().GetInt("num-results")
		searchType, _ := cmd.Flags().GetString("type")
		text, _ := cmd.Flags().GetBool("text")
		highlights, _ := cmd.Flags().GetBool("highlights")
		summary, _ := cmd.Flags().GetBool("summary")
		category, _ := cmd.Flags().GetString("category")
		includeDomains, _ := cmd.Flags().GetString("include-domains")
		excludeDomains, _ := cmd.Flags().GetString("exclude-domains")
		startDate, _ := cmd.Flags().GetString("start-date")
		endDate, _ := cmd.Flags().GetString("end-date")
		autoprompt, _ := cmd.Flags().GetBool("autoprompt")

		// Validate type
		if searchType != "" && !validSearchTypes[searchType] {
			fmt.Fprintf(os.Stderr, "Error: invalid --type %q. Valid types: auto, neural, keyword, hybrid, fast, instant, deep, deep-lite, deep-reasoning\n", searchType)
			os.Exit(1)
		}

		// Parse comma-separated domains
		var inclDomains, exclDomains []string
		if includeDomains != "" {
			for _, d := range strings.Split(includeDomains, ",") {
				d = strings.TrimSpace(d)
				if d != "" {
					inclDomains = append(inclDomains, d)
				}
			}
		}
		if excludeDomains != "" {
			for _, d := range strings.Split(excludeDomains, ",") {
				d = strings.TrimSpace(d)
				if d != "" {
					exclDomains = append(exclDomains, d)
				}
			}
		}

		// Resolve API key
		apiKey, err := ResolveAPIKey(cmd)
		if err != nil {
			fmt.Fprintln(os.Stderr, err)
			os.Exit(1)
		}

		c := client.New(apiKey)

		opts := client.SearchOptions{
			NumResults:     numResults,
			Type:           searchType,
			IncludeDomains: inclDomains,
			ExcludeDomains: exclDomains,
			Category:       category,
			StartDate:      startDate,
			EndDate:        endDate,
			UseAutoprompt:  autoprompt,
			Text:           text,
			Highlights:     highlights,
			Summary:        summary,
		}

		resp, err := c.Search(query, opts)
		if err != nil {
			fmt.Fprintln(os.Stderr, formatters.FormatError(err, asToon))
			os.Exit(1)
		}

		fmt.Print(formatters.FormatSearchResults(resp, asJSON, asToon))
		return nil
	},
}

func init() {
	searchCmd.Flags().Int("num-results", 10, "Number of results to return")
	searchCmd.Flags().String("type", "", "Search type (auto|neural|keyword|hybrid|fast|instant|deep|deep-lite|deep-reasoning)")
	searchCmd.Flags().Bool("text", false, "Include full text content")
	searchCmd.Flags().Bool("highlights", false, "Include highlights")
	searchCmd.Flags().Bool("summary", false, "Include summary")
	searchCmd.Flags().String("category", "", "Category filter")
	searchCmd.Flags().String("include-domains", "", "Comma-separated domains to include")
	searchCmd.Flags().String("exclude-domains", "", "Comma-separated domains to exclude")
	searchCmd.Flags().String("start-date", "", "Start published date (ISO format)")
	searchCmd.Flags().String("end-date", "", "End published date (ISO format)")
	searchCmd.Flags().Bool("autoprompt", false, "Enable Exa autoprompt")

	rootCmd.AddCommand(searchCmd)
}
