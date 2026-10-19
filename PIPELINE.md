# Content pipeline: download, ingest, authenticate

How a publisher's file becomes text in the app, and how the repository proves nothing changed along the way. Each diagram follows the real calls; file names are under `scripts/`.

```mermaid
flowchart LR
  P[Publisher's site] -- "--download" --> S[sources/ committed, checksummed]
  S -- ingest --> R[res/ committed JSON]
  R -- build --> D[docs/resources/ the site]
  S -. authenticate .-> R
  R -. authenticate .-> D
```

## 1. Download: taking a publisher's file

Only when you ask for it (`node scripts/ingest/bsb.js --download`). Everything else works offline from `sources/`.

```mermaid
sequenceDiagram
  actor You
  participant Script as ingest/bsb.js
  participant Src as lib/sources.js
  participant Reg as provenance/registry.json
  participant Pub as bereanbible.com
  participant Lock as lib/lock.js
  participant Store as sources/bsb/

  You->>Script: node scripts/ingest/bsb.js --download
  Script->>Src: loadSourceFiles("bsb", download)
  Src->>Reg: which files? (downloads: bsb.txt, bsb_usx.zip)
  loop each file
    Src->>Pub: GET url (retries with backoff)
    Pub-->>Src: bytes
  end
  Src->>Lock: checkLock("bsb", sha256 of the files)
  Lock->>Reg: recorded sha256
  alt matches
    Lock-->>Src: ok
  else differs, UPDATE_SOURCE_LOCK=1 (you accept a new release)
    Lock->>Reg: record the new sha256
  else differs
    Lock-->>You: stop: "Source has changed since it was verified"
  end
  Src->>Store: write bsb.txt.gz, bsb_usx.zip (no byte of the original changes)
  Note over Script: then continues exactly like ingest (2)
```

## 2. Ingest: converting `sources/` into `res/`

`npm run ingest` runs this for every resource (KJV, BSB, WCF, Henry, Strong's), then validation and authentication.

```mermaid
sequenceDiagram
  actor You
  participant Script as ingest/henry.js
  participant Run as lib/pipeline.js
  participant Src as lib/sources.js
  participant Lock as lib/lock.js
  participant Gen as pipeline.generate()
  participant Res as res/commentaries/henry/

  You->>Script: npm run ingest:henry
  Script->>Run: runPipeline(pipeline)
  Run->>Src: loadSourceFiles("henry")
  Src->>Src: read sources/henry/mhc1..6.xml.gz, gunzip
  Src->>Lock: checkLock (sha256 must match the registry)
  Lock-->>Src: ok (or stop)
  Src-->>Run: the six files
  Run->>Gen: generate(files, ctx)
  Gen->>Res: ctx.readJson KJV (chapter lengths)
  Note over Gen: pure: parse ThML, classify every element (kept or left out by name, unknown = error), build sections
  Gen-->>Run: outputs: Map of path to exact file text, plus notes
  Run->>Res: delete files it owns but no longer makes
  Run->>Res: write each file
  Run-->>You: "henry: wrote 1256 files" and notes (e.g. a marker cut at a chapter end)
```

## 3. Authenticate: proving `res/` is the sources' text

`npm run authenticate`, also inside `npm test` and every `npm run build`. The readers in `authenticate/` are separate code from the converters, so a converter bug can't hide itself.

```mermaid
sequenceDiagram
  participant Caller as npm test / build / you
  participant Auth as authenticate/index.js
  participant Src as sources/ + registry
  participant Conv as ingest pipelines
  participant Res as res/
  participant Read as authenticate readers
  participant Cmp as authenticate/compare.js
  participant Site as docs/resources/

  Caller->>Auth: authenticate()
  Note over Auth,Src: 1. Sources
  Auth->>Src: read every committed file, sha256
  Src-->>Auth: all match the registry, or stop
  Note over Auth,Res: 2. Reproduction
  loop kjv, bsb, wcf, henry, strongs
    Auth->>Conv: generate(files)
    Conv-->>Auth: expected file texts
    Auth->>Res: byte-for-byte compare, missing or extra files
  end
  Note over Auth,Cmp: 3. Verbatim and accounting
  loop each resource
    Auth->>Read: read the source again (own USFM / plain text / ThML / TSV / JSON reader)
    Read-->>Auth: units (verse, title, paragraph, entry) and left-out totals by category
    Auth->>Res: the converted units
    loop every unit
      Auth->>Cmp: compareText(source, output, named exceptions)
      Cmp-->>Auth: same characters and word breaks, or the first difference
    end
    Auth->>Auth: re-derive references, verse ranges, parts of speech, proof texts
  end
  opt after a build
    Note over Auth,Site: 4. Site
    Auth->>Site: every built file equals res/
  end
  Auth-->>Caller: report (✓/✗ per check, left-out totals), fails on any problem
```

## 4. One unit: what "verbatim" means

```mermaid
sequenceDiagram
  participant S as Source unit
  participant C as compareText
  participant O as Output unit
  Note over S,O: e.g. source "let there be light #59;" and output "let there be light#59;"

  C->>S: apply named exceptions (KJV: ¶ removed)
  C->>C: strip whitespace from both
  alt characters differ
    C-->>C: fail "text differs / missing / extra"
  else same characters
    C->>C: compare word-break positions
    alt break in output, none in source
      C-->>C: fail "a word is split"
    else break in source, none in output
      alt a named exception allows it (space before closing punctuation)
        C-->>C: pass
      else
        C-->>C: fail "words are joined"
      end
    else breaks match
      C-->>C: pass
    end
  end
```

## Where each step runs

| Command | Download | Ingest | Authenticate |
|---|---|---|---|
| `node scripts/ingest/<id>.js --download` | yes | yes | no |
| `npm run ingest` | no | all five | yes |
| `npm run authenticate` | no | no (regenerates in memory only) | yes |
| `npm test` | no | no | yes, plus tamper and unit tests, 99% coverage floor |
| `npm run build` | no | no | yes, including the built site |

See [res/SOURCES.md](res/SOURCES.md#authentication) for the exceptions and categories in full.
