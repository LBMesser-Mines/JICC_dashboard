{
	description = "svelte dashboard";
	inputs.nixpkgs.url = "github:NixOS/nixpkgs/nixos-unstable";
	outputs = {self, nixpkgs}:
		let
			system = "x86_64-linux";
			pkgs = nixpkgs.legacyPackages.${system};
		in {
			devShells.${system}.default = pkgs.mkShell {
			 packages = [
			  pkgs.nodejs
			  pkgs.svelte-language-server
			  pkgs.typescript-language-server
			 ];
			 shellHook = ''
			 	export NPM_CONFIG_PREFIX="$PWD/.npm-global"
				export PATH="$NPM_CONFIG_PREFIX/bin:$PATH"
			'';
			};
		};
}
