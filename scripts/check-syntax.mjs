import { readdirSync } from "node:fs";
import { extname, join, resolve } from "node:path";
import { spawnSync } from "node:child_process";

const root = resolve(import.meta.dirname, "..");
const targets = [join(root, "apps"), join(root, "packages"), join(root, "scripts")];

function javascriptFiles(directory) {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) return javascriptFiles(path);
    return [".js", ".mjs"].includes(extname(entry.name)) ? [path] : [];
  });
}

let failed = false;
for (const file of targets.flatMap(javascriptFiles)) {
  const result = spawnSync(process.execPath, ["--check", file], { encoding: "utf8" });
  if (result.status !== 0) {
    failed = true;
    process.stderr.write(result.stderr || result.stdout);
  }
}

if (failed) process.exitCode = 1;
else console.log("Syntax check passed.");
