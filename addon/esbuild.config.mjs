import { build } from "esbuild";

await build({
  entryPoints: ["src/background/index.ts"],
  bundle: true,
  format: "iife",
  outfile: "dist/background.js",
  platform: "browser",
  target: "es2022"
});

