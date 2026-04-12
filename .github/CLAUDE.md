# GitHub Configuration

## SHA Pinning Policy

All actions pinned to **full 40-character commit SHAs**. Tags are mutable and can be hijacked — SHAs are immutable.

Format: `uses: owner/action@<full-sha>  # v1.2.3`

Resolve latest version and SHA:

```bash
for repo in actions/checkout cachix/install-nix-action nix-community/cache-nix-action; do
  tag=$(gh api "repos/$repo/releases/latest" --jq '.tag_name')
  ref=$(gh api "repos/$repo/git/ref/tags/$tag" --jq '.object')
  type=$(echo "$ref" | jq -r '.type')
  sha=$(echo "$ref" | jq -r '.sha')
  if [ "$type" = "tag" ]; then
    sha=$(gh api "repos/$repo/git/tags/$sha" --jq '.object.sha')
  fi
  echo "$repo@$tag → $sha"
done
```

## CI Workflow (`workflows/ci.yml`)

- Triggers: push to any branch
- Permissions: `contents: read`, `id-token: write`
- Jobs: lint → test → build
- Uses `cachix/install-nix-action` to install upstream Nix with flakes enabled
- Uses `nix-community/cache-nix-action` for GitHub Actions cache (keyed on `flake.nix` + `flake.lock`)
- All commands run via `nix develop --command <cmd>` — Go and Task come from `flake.nix`
- Task commands: `task lint` (`go vet ./...`), `task test` (`go test ./...`), `task build`

## PR Workflow (`workflows/pr-tests.yaml`)

- Triggers: pull requests to `main`
- Same Nix setup as `ci.yml`, plus a `gofmt` format check in the lint job

## No Release Workflow

Releases are not automated. Users build from source — see README.
