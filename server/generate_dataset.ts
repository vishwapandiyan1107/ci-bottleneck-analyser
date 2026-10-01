import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const source = path.resolve(root, "data/validation-builds.csv");
const target = path.resolve(root, "data/ci_build_logs.csv");

if (!fs.existsSync(source)) {
  throw new Error(`Source validation dataset not found: ${source}`);
}

fs.copyFileSync(source, target);
const rows = fs.readFileSync(target, "utf8").trim().split(/\r?\n/).length - 1;
console.log(`Generated ${target} with ${rows} reproducible build records.`);
