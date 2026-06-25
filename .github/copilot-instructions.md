# Copilot Instructions for reformstudy.github.io

## Project Overview
This is a Vite + React TypeScript application for the ReformStudy platform, a study app designed to help users explore biblical and theological content. The repository is hosted as a GitHub Pages site.

## Technology Stack
- **Frontend Framework**: React 18 with TypeScript 5
- **Build Tool**: Vite 5 with React plugin
- **UI Icons**: lucide-react
- **Deployment**: GitHub Pages (builds to `docs/` folder)
- **CI/CD**: GitHub Actions for automated build and deployment

## Project Structure
```
src/
  ├── components/
  │   ├── AtlasAndTimeline.tsx      # Timeline and mapping visualization
  │   ├── GenericView.tsx            # Generic view component
  │   ├── GlobalSearch.tsx           # Application search functionality
  │   └── ScriptureReader.tsx        # Scripture reading interface
  ├── App.tsx                        # Main application component
  ├── main.tsx                       # React entry point
  └── styles.css                     # Global styles
```

## Development Commands
- `npm install` - Install dependencies
- `npm run dev` - Start development server (Vite default port)
- `npm run build` - Build for production (outputs to `docs/`)
- `npm run preview` - Preview production build locally

## Code Conventions
1. **Component Structure**: Use functional components with TypeScript
2. **Naming**: Use PascalCase for component files and exports
3. **Imports**: Use ES6 module syntax
4. **Styling**: CSS modules or inline styles in `styles.css`
5. **Type Safety**: Always use TypeScript types for props and state

## Build and Deployment
- The project builds to the `docs/` folder for GitHub Pages compatibility
- GitHub Actions workflow (`.github/workflows/deploy.yml`) automates building and deployment
- The `main` branch is configured as the GitHub Pages source with `/docs` folder
- Changes merged to `main` automatically trigger deployment

## Key Files
- `vite.config.ts` - Vite configuration with React plugin and build output settings
- `tsconfig.json` - TypeScript configuration
- `package.json` - Dependencies and scripts
- `index.html` - Entry HTML file for the React app

## When Making Changes
1. Ensure TypeScript types are correct (build includes `tsc` type checking)
2. Test locally with `npm run dev` before committing
3. Run `npm run build` to verify production build succeeds
4. Components should be self-contained and reusable
5. Update component documentation in code comments if adding new features

## Dependencies to Be Aware Of
- **react** and **react-dom** (^18.3.1) - Core React library
- **lucide-react** (^0.496.0) - Icon library for UI
- **@types/react** and **@types/react-dom** - TypeScript definitions

## Notes for AI Development
- This is a public GitHub Pages site, so all content is accessible
- The app serves scripture and theological study materials
- Focus on UI/UX for accessibility and usability
- Maintain the existing component architecture
- Ensure all new code is TypeScript compliant
