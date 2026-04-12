package commands

import (
	"context"
	"encoding/json"
	"fmt"
	"os"
	"strings"

	"github.com/SoftwareStartups/exacli/internal/client"
	"github.com/SoftwareStartups/exacli/internal/formatters"
	"github.com/spf13/cobra"
)

var validAnswerModels = map[string]bool{
	"exa":     true,
	"exa-pro": true,
}

var answerCmd = &cobra.Command{
	Use:   "answer <query>",
	Short: "Get an AI-powered answer to a query",
	Args:  cobra.MinimumNArgs(1),
	RunE: func(cmd *cobra.Command, args []string) error {
		query := strings.Join(args, " ")

		// Get global flags
		asJSON, _ := cmd.Flags().GetBool("json")
		asToon, _ := cmd.Flags().GetBool("toon")

		// Get answer flags
		text, _ := cmd.Flags().GetBool("text")
		model, _ := cmd.Flags().GetString("model")
		stream, _ := cmd.Flags().GetBool("stream")
		systemPrompt, _ := cmd.Flags().GetString("system-prompt")

		// Validate model
		if model != "" && !validAnswerModels[model] {
			fmt.Fprintf(os.Stderr, "Error: invalid --model %q. Valid models: exa, exa-pro\n", model)
			os.Exit(1)
		}

		// Resolve API key
		apiKey, err := ResolveAPIKey(cmd)
		if err != nil {
			fmt.Fprintln(os.Stderr, err)
			os.Exit(1)
		}

		c := client.New(apiKey)

		opts := client.AnswerOptions{
			Text:         text,
			Model:        model,
			SystemPrompt: systemPrompt,
		}

		if stream {
			var citations []client.Citation

			dedupCitations := func(existing *[]client.Citation, newCitations []client.Citation) {
				seen := make(map[string]bool)
				for _, c := range *existing {
					seen[c.URL] = true
				}
				for _, c := range newCitations {
					if !seen[c.URL] {
						*existing = append(*existing, c)
						seen[c.URL] = true
					}
				}
			}

			titleOrUntitled := func(c client.Citation) string {
				if c.Title != "" {
					return c.Title
				}
				return "Untitled"
			}

			if !asJSON {
				fmt.Print("# Answer (streaming)\n\n## Response\n\n")
			}

			err := c.StreamAnswer(context.Background(), query, opts, func(chunk client.AnswerChunk) {
				if chunk.Content != "" {
					os.Stdout.WriteString(chunk.Content)
				}
				dedupCitations(&citations, chunk.Citations)
			})
			if err != nil {
				fmt.Fprintln(os.Stderr, formatters.FormatError(err, asToon))
				os.Exit(1)
			}

			fmt.Print("\n")

			if !asJSON && len(citations) > 0 {
				fmt.Print("\n## Citations\n\n")
				for i, c := range citations {
					fmt.Printf("%d. [%s](%s)\n", i+1, titleOrUntitled(c), c.URL)
				}
			} else if asJSON && len(citations) > 0 {
				type jsonCitations struct {
					Citations []client.Citation `json:"citations"`
				}
				data, _ := json.MarshalIndent(jsonCitations{Citations: citations}, "", "  ")
				fmt.Println(string(data))
			}
		} else {
			resp, err := c.Answer(query, opts)
			if err != nil {
				fmt.Fprintln(os.Stderr, formatters.FormatError(err, asToon))
				os.Exit(1)
			}

			fmt.Print(formatters.FormatAnswerResponse(resp, asJSON, asToon))
		}

		return nil
	},
}

func init() {
	answerCmd.Flags().Bool("text", false, "Include full text content in results")
	answerCmd.Flags().String("model", "", "Model to use (exa|exa-pro)")
	answerCmd.Flags().Bool("stream", false, "Stream the answer via SSE")
	answerCmd.Flags().String("system-prompt", "", "System prompt for the AI model")

	rootCmd.AddCommand(answerCmd)
}
