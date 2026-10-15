import { build } from "esbuild";
import { rm } from "node:fs/promises";
import { spawn } from "node:child_process";

const outputFiles = [
  ".tmp-article-transform.test.mjs",
  ".tmp-seo-routing.test.mjs",
];

try {
  await Promise.all([
    build({
      entryPoints: ["tests/article-transform.test.ts"],
      outfile: outputFiles[0],
      bundle: true,
      format: "esm",
      platform: "node",
      sourcemap: false,
      packages: "external",
    }),
    build({
      entryPoints: ["tests/seo-routing.test.ts"],
      outfile: outputFiles[1],
      bundle: true,
      format: "esm",
      platform: "node",
      sourcemap: false,
      packages: "external",
      define: {
        "import.meta.env.VITE_WORDPRESS_API": '"https://cms.example.test/wp-json/wp/v2"',
      },
    }),
  ]);

  await new Promise((resolve, reject) => {
    const child = spawn(process.execPath, ["--test", ...outputFiles], { stdio: "inherit" });
    child.on("error", reject);
    child.on("exit", code => code === 0 ? resolve() : reject(new Error(`Project tests exited with code ${code}.`)));
  });
} finally {
  await Promise.all(outputFiles.map(outputFile => rm(outputFile, { force: true })));
}
