import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";

const { packages } = JSON.parse(readFileSync("package-lock.json", "utf8"));
const bindingPrefix = "/@rolldown/binding-";
const rolldownSuffix = "/node_modules/rolldown";
const libc =
  process.platform === "linux"
    ? process.report.getReport().header.glibcVersionRuntime
      ? "glibc"
      : "musl"
    : undefined;
const matches = (values, current) => !values || values.includes(current);
const npm = (...args) => execFileSync("npm", args, { stdio: "inherit" });

// npm treats even download/extraction failures of optional packages as success.
// Fetch the locked native artifacts as mandatory operations before npm ci can
// silently omit them. Keep every platform in the lockfile; select only this host.
for (const [path, pkg] of Object.entries(packages)) {
  if (
    path.includes(bindingPrefix) &&
    matches(pkg.os, process.platform) &&
    matches(pkg.cpu, process.arch) &&
    matches(pkg.libc, libc)
  ) {
    console.log(`Caching required native artifact: ${path}@${pkg.version}`);
    npm("cache", "add", pkg.resolved);
  }
}

// Prefer the mandatory cached artifacts; ci still verifies lockfile integrity.
npm("ci", "--include=optional", "--prefer-offline");

// Validate each locked Rolldown instance, including Vite's nested version.
// This also prevents Docker from caching a successful but incomplete install.
for (const path of Object.keys(packages)) {
  if (`/${path}`.endsWith(rolldownSuffix)) {
    const require = createRequire(resolve(path, "package.json"));
    await import(pathToFileURL(require.resolve("rolldown")).href);
    console.log(`Native binding loaded: ${path}`);
  }
}
