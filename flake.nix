{
  description = "exacli — Exa AI search CLI";

  inputs = {
    nixpkgs.url = "github:nixos/nixpkgs/nixpkgs-unstable";
    flake-utils.url = "github:numtide/flake-utils";
  };

  outputs = { self, nixpkgs, flake-utils }:
    flake-utils.lib.eachDefaultSystem (system:
      let
        pkgs = nixpkgs.legacyPackages.${system};
      in {
        devShells.default = pkgs.mkShell {
          packages = with pkgs; [
            go_1_25      # matches go.mod (go 1.25.5)
            go-task      # task runner (Taskfile.yml)
            lefthook     # git hooks
            golangci-lint
          ];

          shellHook = ''
            echo "exacli dev environment"
            go version
            lefthook install --force
          '';
        };
      });
}
