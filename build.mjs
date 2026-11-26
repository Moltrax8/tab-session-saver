import { build } from "esbuild";
import { cp, rm, mkdir } from "node:fs/promises";

await rm("dist", { recursive: true, force: true });
await mkdir("dist", { recursive: true });
await cp("public", "dist", { recursive: true });
await build({
  entryPoints: { popup: "src/popup.ts" },
  outdir: "dist",
  bundle: true,
  format: "iife",
  target: "chrome120",
  minify: true,
  sourcemap: false,
});
console.log("Built to dist/. Load it via chrome://extensions > Load unpacked.");
