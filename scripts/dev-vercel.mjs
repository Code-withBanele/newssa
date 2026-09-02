import { readFileSync } from "node:fs";
import { spawn } from "node:child_process";

for (const fileName of [".env.local", ".env.development.local"]) {
  const envFile = readFileSync(new URL(`../${fileName}`, import.meta.url), "utf8");
  for (const line of envFile.split(/\r?\n/)) {
    const match = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)\s*$/);
    if (!match || process.env[match[1]]) continue;
    process.env[match[1]] = match[2].replace(/^(["'])(.*)\1$/, "$2");
  }
}

const command = process.platform === "win32" ? "npx.cmd" : "npx";
const child = spawn(command, ["vercel", "dev", ...process.argv.slice(2)], {
  stdio: "inherit",
  env: process.env,
  shell: process.platform === "win32",
});

child.on("exit", (code, signal) => {
  if (signal) process.kill(process.pid, signal);
  process.exit(code ?? 1);
});