import { build } from "esbuild";
import { rm } from "node:fs/promises";
import { spawn } from "node:child_process";

const outputFile = ".tmp-article-transform.test.mjs";

try {
  await build({
    entryPoints: ["tests/article-transform.test.ts"],
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
    child.on("exit", code => code === 0 ? resolve() : reject(new Error(`Article transform tests exited with code ${code}.`)));
  });
} finally {
  await rm(outputFile, { force: true });
}
