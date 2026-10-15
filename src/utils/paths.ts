/**
 * URL of a file the site serves, relative to where the app is deployed: "/" for
 * the live site, "/preview/" for the preview (Vite's `base`, set by BASE_PATH).
 */
export function siteUrl(path: string): string {
  return `${import.meta.env.BASE_URL}${path.replace(/^\//, '')}`;
}
