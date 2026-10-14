# reformstudy.github.io

This repository hosts a Vite + React study app for ReformStudy, featuring a modular resource system for biblical and theological content.

## Key Features

- **React 18 + TypeScript** - Modern, type-safe frontend
- **Vite** - Fast build tool and dev server
- **Resource System** - Modular architecture for Bible versions, commentaries, confessions, and Strong's concordances
- **On-Demand Loading** - Resources are fetched and cached in memory as needed, not bundled with the app
- **GitHub Pages** - Automatic deployment on every commit

## Local development

```bash
npm install
npm run dev
```

## Build

```bash
npm run build
```

This command:
1. Runs TypeScript type checking
2. Builds the React app with Vite
3. Automatically processes and bundles resources
4. Outputs to `docs/` for GitHub Pages

## Resource Management

The app uses a modular resource system for managing:
- **Bible Versions** - Multiple translations and versions
- **Confessions** - Historical confessional documents
- **Commentaries** - Verse-by-verse biblical commentary
- **Strong's Concordances** - Greek and Hebrew word studies

Resources are stored in `/res` and automatically built into `/docs/resources/` during the build process.

See [RESOURCES.md](RESOURCES.md) for detailed information about the resource system.

## GitHub Pages deployment

`.github/workflows/deploy.yml` builds two sites and publishes them to the `gh-pages` branch:

- **Live:** https://reformstudy.github.io/, built from the latest release tag (`v*`).
- **Preview:** https://reformstudy.github.io/preview/, built from `main`. It shows what has changed since the live release.

Merging to `main` updates only the preview; tagging a release puts it live. See [RELEASING.md](RELEASING.md).

## Project Structure

```
src/
  ├── components/          # React components
  ├── utils/
  │   ├── resourceLoader.ts    # Resource loading utilities
  │   └── ResourceBrowserExample.tsx  # Example resource usage
  ├── App.tsx              # Main app component
  └── styles.css           # Global styles

res/
  ├── bibles/              # Bible version files
  ├── confessions/         # Confession files
  ├── commentaries/        # Commentary files
  └── strongs/             # Strong's concordance files

scripts/
  └── build-resources.js   # Resource build script

docs/                      # GitHub Pages output (generated)
  └── resources/           # Built resources (generated)
```

