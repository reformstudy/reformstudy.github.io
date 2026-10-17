# Releasing

The site has two channels, built by `.github/workflows/deploy.yml` on every push to `main` and every release tag:

| Channel | URL | Built from |
|---|---|---|
| **Live** | https://reformstudy.github.io/ | the latest release tag (`v*`, highest version) |
| **Preview** | https://reformstudy.github.io/preview/ | `main` |

Merging a pull request changes only the preview. Nothing reaches the live site until you tag a release.

The preview is marked everywhere:
- a "Preview" badge in the header;
- a banner on every page.

## Version and changes panel

Both channels show their version in the header. Clicking it opens **About this version**:
- **App:** the version, commit and build time.
- **Content:** a fingerprint of everything in `res/`, and the organization, source and license of each resource.
- **Changes from live (preview only):** every content change since the live release. Bibles are listed verse by verse, with the old and new text; the WCF by section and proof references; Strong's by entry; Henry by file.

## Releasing a version

1. **Look at the preview.** Check the changes list in the panel. The same list is available from the command line:
   ```bash
   npm run content:diff -- v0.1.0        # replace with the current live tag
   ```
2. **Tag the commit on `main` and push the tag.** The workflow rebuilds both sites, and the tagged commit goes live.
   ```bash
   git tag -a v1.0.0 -m "Reformation Day release" origin/main
   git push origin v1.0.0
   ```
   You can also create a release in GitHub's **Releases** page with a new `v…` tag on `main`.

**Versions:** use `vMAJOR.MINOR.PATCH`. Bump the minor version for new content or features, and the patch version for corrections.

**Rolling back:** tag the earlier commit with a higher version (for example `v1.0.1` on the commit of `v0.9.0`), or delete the bad tag and re-run the workflow (**Actions → Build and Deploy → Run workflow**).

## First-time setup

The workflow stops with an error, and deploys nothing, until at least one `v*` tag exists. Before the first deploy with this workflow, tag the commit that is live today:

```bash
git tag -a v0.1.0 -m "Site before the v1 content pipeline" 252a67b
git push origin v0.1.0
```

## Building a channel locally

```bash
RS_CHANNEL=live npm run build                                                    # as the live site
RS_CHANNEL=preview BASE_PATH=/preview/ RS_LIVE_REF=v0.1.0 npm run build          # as the preview
```

Both builds write `docs/build.json`. The preview build also writes `docs/changes.json`. `BASE_PATH` sets where the app is served from, and all fetches go through `src/utils/paths.ts`.
