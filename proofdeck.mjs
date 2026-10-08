#!/usr/bin/env node
/**
 * ProofDeck: static evidence checker for repository claims.
 * No dependencies, shell execution, network or dynamically loaded user modules.
 */
import { readFile, stat } from "node:fs/promises";
import { resolve, relative, isAbsolute, sep } from "node:path";
import { pathToFileURL } from "node:url";

const TYPES = new Set(["exists", "contains", "notContains"]);
function safePath(root, file) {
  if (typeof file !== "string" || !file || isAbsolute(file) || file.includes("\\") || file.split("/").some(s => s === ".." || s === "" || s === ".")) {
    throw new Error("Unsafe relative file path: " + file);
  }
  const target = resolve(root, file);
  const rel = relative(root, target);
  if (rel.startsWith(".." + sep) || rel === ".." || isAbsolute(rel)) throw new Error("File escapes repository root");
  return target;
}
export function validateManifest(manifest) {
  if (!manifest || manifest.version !== 1 || !Array.isArray(manifest.claims)) throw new Error("Expected manifest with version: 1 and claims array");
  if (manifest.claims.length > 500) throw new Error("Too many claims");
  const ids = new Set();
  return manifest.claims.map(claim => {
    if (!claim || typeof claim.id !== "string" || !/^[a-z0-9-]{1,64}$/.test(claim.id) || ids.has(claim.id)) throw new Error("Invalid or duplicate claim ID");
    ids.add(claim.id);
    if (typeof claim.title !== "string" || !claim.title.trim() || claim.title.length > 180) throw new Error("Invalid claim title");
    if (!Array.isArray(claim.evidence) || claim.evidence.length === 0 || claim.evidence.length > 30) throw new Error("Each claim needs 1–30 evidence rules");
    for (const rule of claim.evidence) {
      if (!rule || !TYPES.has(rule.type) || typeof rule.file !== "string") throw new Error("Invalid evidence rule");
      if (rule.type !== "exists" && (typeof rule.text !== "string" || rule.text.length === 0 || rule.text.length > 500)) throw new Error("Text required for content rule");
    }
    return claim;
  });
}
async function checkRule(root, rule) {
  try {
    const file = safePath(root, rule.file);
    // Reject symbolic links (including parent directories) to avoid reading outside the workspace.
    const parts = rule.file.split("/");
    let cursor = root;
    for (const part of parts) {
      cursor = resolve(cursor, part);
      const entry = await import("node:fs/promises").then(fs => fs.lstat(cursor));
      if (entry.isSymbolicLink()) return { status: "UNKNOWN", detail: "Symbolic link not inspected" };
    }
    const info = await stat(file);
    if (!info.isFile()) return { status: "FAIL", detail: "Not a regular file" };
    if (rule.type === "exists") return { status: "PASS", detail: "File exists" };
    if (info.size > 1024 * 1024) return { status: "UNKNOWN", detail: "File exceeds 1 MiB inspection limit" };
    const source = await readFile(file, "utf8");
    const present = source.includes(rule.text);
    return { status: (rule.type === "contains" ? present : !present) ? "PASS" : "FAIL", detail: rule.type === "contains" ? "Required text check" : "Forbidden text check" };
  } catch (error) {
    if (error.code === "ENOENT") return { status: "FAIL", detail: "File missing" };
    return { status: "UNKNOWN", detail: error.message };
  }
}
export async function inspect(manifest, root) {
  const claims = validateManifest(manifest);
  const results = [];
  for (const claim of claims) {
    const evidence = [];
    for (const rule of claim.evidence) {
      const result = await checkRule(root, rule);
      evidence.push({ type: rule.type, file: rule.file, ...result });
    }
    const status = evidence.some(e => e.status === "FAIL") ? "FAIL" : evidence.some(e => e.status === "UNKNOWN") ? "UNKNOWN" : "PASS";
    results.push({ id: claim.id, title: claim.title, status, evidence });
  }
  return { summary: Object.fromEntries(["PASS", "FAIL", "UNKNOWN"].map(status => [status.toLowerCase(), results.filter(r => r.status === status).length])), results };
}
function markdown(report) {
  const rows = ["# ProofDeck evidence report", "", "| Claim | Result | Evidence |", "| --- | --- | --- |"];
  for (const r of report.results) rows.push("| " + r.title.replaceAll("|", "\\|").replaceAll("\n", " ") + " | " + r.status + " | " + r.evidence.map(e => e.type + ": `" + e.file.replaceAll("|", "") + "` (" + e.status + ")").join("; ") + " |");
  rows.push("", "Evidence checks establish file/text presence only, not that a feature works correctly.");
  return rows.join("\n");
}
export async function main(args, output = console) {
  const [command, manifestPath = "proofdeck.json", rootPath = ".", format = "text"] = args;
  if (command !== "check" || !["text", "json", "markdown"].includes(format)) {
    output.error("Usage: node proofdeck.mjs check [manifest.json] [repository-root] [text|json|markdown]");
    return 2;
  }
  try {
    const manifest = JSON.parse(await readFile(resolve(manifestPath), "utf8"));
    const report = await inspect(manifest, resolve(rootPath));
    if (format === "json") output.log(JSON.stringify(report, null, 2));
    else if (format === "markdown") output.log(markdown(report));
    else {
      for (const r of report.results) output.log(r.status.padEnd(8) + r.id + " — " + r.title);
      output.log("PASS " + report.summary.pass + " | FAIL " + report.summary.fail + " | UNKNOWN " + report.summary.unknown);
    }
    return report.summary.fail ? 1 : report.summary.unknown ? 3 : 0;
  } catch (error) {
    output.error(error.message);
    return 2;
  }
}
if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) process.exitCode = await main(process.argv.slice(2));
