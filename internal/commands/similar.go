package commands

import (
	"fmt"
	"os"

	"github.com/spf13/cobra"
	"github.com/wesbragagt/exacli/internal/client"
	"github.com/wesbragagt/exacli/internal/formatters"
)

var similarCmd = &cobra.Command{
	Use:   "similar <url>",
	Short: "Find similar pages to a URL",
	Args:  cobra.ExactArgs(1),
	RunE: func(cmd *cobra.Command, args []string) error {
		url := args[0]

		// Get global flags
		asJSON, _ := cmd.Flags().GetBool("json")
		asToon, _ := cmd.Flags().GetBool("toon")

		// Get similar flags
		numResults, _ := cmd.Flags().GetInt("num-results")
		excludeSourceDomain, _ := cmd.Flags().GetBool("exclude-source-domain")
		text, _ := cmd.Flags().GetBool("text")
		highlights, _ := cmd.Flags().GetBool("highlights")
		summary, _ := cmd.Flags().GetBool("summary")
		category, _ := cmd.Flags().GetString("category")

		// Resolve API key
		apiKey, err := ResolveAPIKey(cmd)
		if err != nil {
			fmt.Fprintln(os.Stderr, err)
			os.Exit(1)
		}

		c := client.New(apiKey)

		opts := client.FindSimilarOptions{
			NumResults:          numResults,
			ExcludeSourceDomain: excludeSourceDomain,
			Category:            category,
			Text:                text,
			Highlights:          highlights,
			Summary:             summary,
		}

		resp, err := c.FindSimilar(url, opts)
		if err != nil {
			fmt.Fprintln(os.Stderr, formatters.FormatError(err, asToon))
			os.Exit(1)
		}

		fmt.Print(formatters.FormatSearchResults(resp, asJSON, asToon))
		return nil
	},
}

func init() {
	similarCmd.Flags().Int("num-results", 0, "Number of results to return")
	similarCmd.Flags().Bool("exclude-source-domain", false, "Exclude results from source domain")
	similarCmd.Flags().Bool("text", false, "Include full text content")
	similarCmd.Flags().Bool("highlights", false, "Include highlights")
	similarCmd.Flags().Bool("summary", false, "Include summary")
	similarCmd.Flags().String("category", "", "Category filter")

	rootCmd.AddCommand(similarCmd)
}
