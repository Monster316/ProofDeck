import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, mkdir, writeFile, symlink, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { inspect, validateManifest } from "./proofdeck.mjs";

const manifest = (evidence) => ({ version: 1, claims: [{ id: "feature-one", title: "Evidence for feature one", evidence }] });
test("checks presence and positive/negative text", async () => {
  const root = await mkdtemp(join(tmpdir(), "proofdeck-"));
  try {
    await mkdir(join(root, "src"));
    await writeFile(join(root, "src", "index.js"), "export const ready = true;");
    const report = await inspect(manifest([
      { type: "exists", file: "src/index.js" },
      { type: "contains", file: "src/index.js", text: "ready = true" },
      { type: "notContains", file: "src/index.js", text: "TODO" }
    ]), root);
    assert.equal(report.summary.pass, 1);
    assert.equal(report.summary.fail, 0);
  } finally { await rm(root, { recursive: true, force: true }); }
});
test("missing evidence fails rather than passing silently", async () => {
  const root = await mkdtemp(join(tmpdir(), "proofdeck-"));
  try {
    const report = await inspect(manifest([{ type: "exists", file: "missing.md" }]), root);
    assert.equal(report.summary.fail, 1);
  } finally { await rm(root, { recursive: true, force: true }); }
});
test("rejects path traversal and duplicate claim IDs", async () => {
  const root = await mkdtemp(join(tmpdir(), "proofdeck-"));
  try {
    const report = await inspect(manifest([{ type: "exists", file: "../outside" }]), root);
    assert.equal(report.summary.unknown, 1);
    assert.throws(() => validateManifest({ version: 1, claims: [manifest([]).claims[0], manifest([]).claims[0]] }));
  } finally { await rm(root, { recursive: true, force: true }); }
});
test("symlink targets are not inspected", async () => {
  const root = await mkdtemp(join(tmpdir(), "proofdeck-"));
  try {
    await symlink(tmpdir(), join(root, "external"));
    const report = await inspect(manifest([{ type: "exists", file: "external/secret" }]), root);
    assert.equal(report.summary.unknown, 1);
  } finally { await rm(root, { recursive: true, force: true }); }
});
