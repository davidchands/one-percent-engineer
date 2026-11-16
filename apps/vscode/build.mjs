// Bundles the extension into one CommonJS file. `vscode` is provided by the editor at runtime.
import { context, build } from "esbuild";

const options = {
  entryPoints: ["src/extension.ts"],
  bundle: true,
  outfile: "dist/extension.js",
  platform: "node",
  format: "cjs",
  target: "node20",
  external: ["vscode"],
  sourcemap: true,
  logLevel: "info",
};

if (process.argv.includes("--watch")) await (await context(options)).watch();
else await build(options);
