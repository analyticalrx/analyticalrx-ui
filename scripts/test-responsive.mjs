import { spawn } from "node:child_process";
import { createRequire } from "node:module";
import { dirname, join } from "node:path";

const require = createRequire(import.meta.url);
// Keep browser downloads inside this UI project's ignored node_modules folder.
const cli = join(dirname(require.resolve("playwright/package.json")), "cli.js");
const child = spawn(process.execPath, [cli, ...(process.argv.slice(2).length ? process.argv.slice(2) : ["test"])], {
  stdio: "inherit",
  env: { ...process.env, PLAYWRIGHT_BROWSERS_PATH: "0" },
});
child.on("error", (error) => { console.error(error.message); process.exitCode = 1; });
child.on("exit", (code) => { process.exitCode = code ?? 1; });
