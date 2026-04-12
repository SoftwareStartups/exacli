package commands

import (
	"fmt"
	"net/url"
	"os"

	"github.com/spf13/cobra"
	"github.com/wesbragagt/exacli/internal/client"
	"github.com/wesbragagt/exacli/internal/formatters"
)

var contentsCmd = &cobra.Command{
	Use:   "contents <url> [url ...]",
	Short: "Get content from URLs",
	Args:  cobra.MinimumNArgs(1),
	RunE: func(cmd *cobra.Command, args []string) error {
		// Get global flags
		asJSON, _ := cmd.Flags().GetBool("json")
		asToon, _ := cmd.Flags().GetBool("toon")

		// Get contents flags
		text, _ := cmd.Flags().GetBool("text")
		highlights, _ := cmd.Flags().GetBool("highlights")
		summary, _ := cmd.Flags().GetBool("summary")
		maxAgeHours, _ := cmd.Flags().GetInt("max-age-hours")

		// Validate URLs
		var urls []string
		for _, urlStr := range args {
			parsed, err := url.Parse(urlStr)
			if err != nil || (parsed.Scheme != "http" && parsed.Scheme != "https") {
				fmt.Fprintf(os.Stderr, "Error: invalid URL %q\n", urlStr)
				os.Exit(1)
			}
			urls = append(urls, urlStr)
		}

		// Resolve API key
		apiKey, err := ResolveAPIKey(cmd)
		if err != nil {
			fmt.Fprintln(os.Stderr, err)
			os.Exit(1)
		}

		c := client.New(apiKey)

		opts := client.ContentsOptions{
			Text:        text,
			Highlights:  highlights,
			Summary:     summary,
			MaxAgeHours: maxAgeHours,
		}

		resp, err := c.GetContents(urls, opts)
		if err != nil {
			fmt.Fprintln(os.Stderr, formatters.FormatError(err, asToon))
			os.Exit(1)
		}

		fmt.Print(formatters.FormatSearchResults(resp, asJSON, asToon))
		return nil
	},
}

func init() {
	contentsCmd.Flags().Bool("text", false, "Include full text content")
	contentsCmd.Flags().Bool("highlights", false, "Include highlights")
	contentsCmd.Flags().Bool("summary", false, "Include summary")
	contentsCmd.Flags().Int("max-age-hours", 0, "Maximum age of content in hours")

	rootCmd.AddCommand(contentsCmd)
}
