# Claude Instructions for reformstudy.github.io

## Project Identity
**reformstudy.github.io** is a React + TypeScript web application for the ReformStudy platform—a digital study tool for biblical and theological research. The application is deployed as a GitHub Pages site with automated CI/CD via GitHub Actions.

## Technology Stack & Tooling
- **Runtime**: Node.js (ES modules)
- **Frontend**: React 18 with TypeScript 5
- **Bundler**: Vite 5 (with React plugin)
- **Icons**: lucide-react
- **Hosting**: GitHub Pages (source: `main` branch, `/docs` folder)
- **Type Checking**: TypeScript compiler (part of build)

## Repository Structure
```
/reformstudy.github.io/
├── src/
│   ├── components/
│   │   ├── AtlasAndTimeline.tsx      # Geographic and historical timeline views
│   │   ├── GenericView.tsx            # Reusable generic view component
│   │   ├── GlobalSearch.tsx           # Application-wide search interface
│   │   └── ScriptureReader.tsx        # Scripture content reader
│   ├── App.tsx                        # Root application component
│   ├── main.tsx                       # React DOM mount point
│   └── styles.css                     # Global stylesheet
├── package.json                       # Dependencies & scripts
├── tsconfig.json                      # TypeScript configuration
├── vite.config.ts                     # Vite build configuration
├── index.html                         # HTML entry point
└── docs/                              # GitHub Pages deployment folder (generated)
```

## Development Workflow
### Initial Setup
```bash
npm install
```

### Local Development
```bash
npm run dev
```
Starts Vite dev server with HMR (Hot Module Replacement).

### Building
```bash
npm run build
```
- Runs TypeScript type checking via `tsc`
- Bundles with Vite
- Outputs to `docs/` for GitHub Pages

### Preview
```bash
npm run preview
```
Serves the built `docs/` folder to verify production output.

## Code Standards & Patterns
1. **Components**: Functional components only, use TypeScript for all props
2. **File Naming**: PascalCase for `.tsx` files (e.g., `ScriptureReader.tsx`)
3. **Module System**: ES6 `import/export`
4. **Styling**: Use `styles.css` for global styles; component-specific styling via inline styles or className
5. **Type Safety**: Always define prop types; avoid `any`
6. **Imports**: lucide-react for icons, React for hooks and JSX

## Key Architectural Patterns
- **Component Hierarchy**: App.tsx is the root; components in `src/components/` are feature-specific
- **Scripture Content**: ScriptureReader handles scripture display and navigation
- **Search**: GlobalSearch provides app-wide search capability
- **Atlas/Timeline**: AtlasAndTimeline integrates geographic and temporal navigation
- **Generic Views**: GenericView provides flexible container for various content types

## Build & Deployment Pipeline
- **Source Control**: `main` branch
- **Automation**: GitHub Actions (`.github/workflows/deploy.yml`)
- **Build Output**: `docs/` directory
- **Hosting**: GitHub Pages (configured to serve `/docs` from `main`)
- **Process**: Commits to `main` → GH Actions builds → outputs to `docs/` → auto-deployed

## Important Configuration Details
- **Vite Base Path**: Set to `/` (root domain)
- **Build Output**: `docs/` (required for GitHub Pages)
- **React Plugin**: `@vitejs/plugin-react` with TSX support
- **No Environment Files**: Standard Vite setup (can add `.env` if needed)

## When Contributing Code
- Write TypeScript; avoid JavaScript where possible
- Test with `npm run dev` before pushing
- Verify `npm run build` completes successfully
- Keep components focused and reusable
- Add inline documentation for complex logic
- Ensure accessibility in new UI components

## Dependencies Reference
| Package | Version | Purpose |
|---------|---------|---------|
| react | ^18.3.1 | Core UI framework |
| react-dom | ^18.3.1 | React DOM rendering |
| lucide-react | ^0.496.0 | Icon components |
| typescript | ^5.6.2 | Type checker |
| vite | ^5.4.1 | Build tool |
| @vitejs/plugin-react | ^4.3.1 | Vite React integration |

## Common Scenarios

### Adding a New Component
1. Create `src/components/NewComponent.tsx` with TypeScript types
2. Export from component file
3. Import and use in App.tsx or other components
4. Add global styles to `styles.css` if needed

### Fixing Type Errors
- Run `npm run build` to see all TypeScript errors
- Check `tsconfig.json` for strict settings
- Ensure all prop types are explicitly defined

### Updating Dependencies
- Modify `package.json`
- Run `npm install`
- Test with `npm run dev` and `npm run build`
- Commit lockfile

## Notes for AI Agents
- This project prioritizes type safety and build reliability
- All code changes must pass TypeScript compilation
- The app serves scripture and theological content—maintain content integrity
- GitHub Pages has specific deployment requirements (hence `docs/` folder)
- UI should support both desktop and mobile viewing
- Accessibility is important for an educational tool
