[![Node.js Tests](https://github.com/Monster316/ProofDeck/actions/workflows/tests.yml/badge.svg)](https://github.com/Monster316/ProofDeck/actions/workflows/tests.yml)

# ProofDeck

**A tiny, dependency-free repository claim-to-evidence checker.**

> Experimental developer tool. The checks are deliberately narrow: they verify the presence of specified files or exact text, **not** application correctness, security or test coverage.

## The idea

Project READMEs and handoff documents often promise features without pointing to supporting artifacts. ProofDeck lets maintainers write a small, reviewable manifest stating what repository evidence should exist. It returns **PASS**, **FAIL**, or **UNKNOWN** per claim, making missing documentation or accidentally removed artifacts visible before a release.

This is a distinct focus from existing test-impact analyzers: ProofDeck asks *"Does the repository still contain the evidence for our published claims?"*, not *"Which tests should we run?"*

## Getting started

Requires Node.js **20+**, no packages to install.

```bash
# from the root of this repository:
node proofdeck.mjs check example.proofdeck.json . json
node --test proofdeck.test.mjs
```

The provided example is **illustrative** and deliberately requires `config.example.txt`, which is not bundled, so it will show a failing claim unless you create the sample files.

For your own project, copy `proofdeck.mjs` and create `proofdeck.json`:

```json
{
  "version": 1,
  "claims": [
    {
      "id": "api-guide",
      "title": "An API guide is included",
      "evidence": [
        { "type": "exists", "file": "docs/api.md" },
        { "type": "contains", "file": "docs/api.md", "text": "Authentication" }
      ]
    }
  ]
}
```

Then run:

```bash
node proofdeck.mjs check proofdeck.json . markdown
```

### Exit codes

- **0:** All claims have matching static evidence
- **1:** At least one claim failed
- **2:** Invalid input or CLI error
- **3:** No failing claims, but at least one could not be inspected

### Current limits

- Reads only local regular text files (1 MiB per content check)
- No shell execution, external dependencies, APIs, uploads or network calls
- Rejects traversal paths and avoids symlinks
- Exact substring matching only; no source parsing or semantic verification
- A passing rule is *not proof of runtime behavior*, compliance or security

## Roadmap

- Claim-to-test mapping and report artifacts
- GitHub Actions sample integration
- HTML reports and evidence diffs across releases
- Optional machine-verifiable attestations

## Contributing

Ideas, test cases, and pull requests are welcome. Start with a focused issue describing a new static evidence rule.

**Maintainer:** [@Monster316](https://github.com/Monster316) · [Design Dropper](https://designdropper.com)
