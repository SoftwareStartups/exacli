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

        exacli = pkgs.buildGoModule {
          pname = "exacli";
          version = "dev";
          src = ./.;
          vendorHash = "sha256-CCXEe17ole7HsCpMLhyHiAWnIv9t1gK3hz2+CdtpWeE=";
        };
      in {
        packages.default = exacli;

        apps.default = {
          type = "app";
          program = "${exacli}/bin/exacli";
        };

        devShells.default = pkgs.mkShell {
          packages = with pkgs; [
            go_1_25      # matches go.mod (go 1.25.5)
            go-task      # task runner (Taskfile.yml)
            golangci-lint
          ];

          shellHook = ''
            echo "exacli dev environment"
            go version
            git config core.hooksPath .githooks
          '';
        };
      });
}
