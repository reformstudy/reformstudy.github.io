# reformstudy.github.io

This repository now hosts a Vite + React study app for Project Covenant.

## Local development

```bash
npm install
npm run dev
```

## Build

```bash
npm run build
```

## GitHub Pages deployment

A GitHub Actions workflow is configured at `.github/workflows/deploy.yml`.
It builds the app and publishes the generated `dist` output to the `gh-pages` branch.

If this repository is intended to serve as a user site, ensure GitHub Pages is configured to use the `gh-pages` branch as the site source or switch to a `/docs` deploy path.
