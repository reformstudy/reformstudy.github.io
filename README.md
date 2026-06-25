# reformstudy.github.io

This repository now hosts a Vite + React study app for ReformStudy.

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
It builds the app into `docs/` and commits the generated output back to the `main` branch.

For this user site repo, configure GitHub Pages to use the `main` branch and the `/docs` folder as the site source.
