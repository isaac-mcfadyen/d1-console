import { buildSync } from "esbuild";
import packageJson from "./package.json" assert { type: "json"};

buildSync({
	entryPoints: ["./src/index.ts"],
	outfile: "./bin/cli.js",
	format: "esm",
	bundle: true,
	minify: true,
	legalComments: "none",
	platform: "node",
	define: {
		VERSION: `\"v${packageJson.version.toString()}\"`
	},
	banner: {
		js: "#!/usr/bin/env node\nimport { createRequire } from 'module';const require = createRequire(import.meta.url);",
	},
});
