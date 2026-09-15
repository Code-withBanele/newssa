import { build } from "esbuild";
import { rm } from "node:fs/promises";
import { spawn } from "node:child_process";

const outputFile = ".tmp-phase2a-dispatch.test.mjs";

try {
  await build({
    entryPoints: ["tests/phase2a-dispatch.test.ts"],
    outfile: outputFile,
    bundle: true,
    format: "esm",
    platform: "node",
    sourcemap: false,
    packages: "external",
  });

  await new Promise((resolve, reject) => {
    const child = spawn(process.execPath, ["--test", outputFile], { stdio: "inherit" });
    child.on("error", reject);
    child.on("exit", code => code === 0 ? resolve() : reject(new Error(`Phase 2A tests exited with code ${code}.`)));
  });
} finally {
  await rm(outputFile, { force: true });
}