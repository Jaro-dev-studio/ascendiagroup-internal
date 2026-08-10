import { EXACT_MATCH_ONLY_PATHS } from "@/config/page-labels";

// Shared by the dashboard layout and the client-side navigation, so a page hidden
// from the sidebar is also blocked on the server.
export function isPathAllowed(allowedPaths: string[], pathname: string): boolean {
  return allowedPaths.some((allowed) => {
    if (pathname === allowed) return true;
    if (EXACT_MATCH_ONLY_PATHS.includes(allowed)) return false;
    return pathname.startsWith(`${allowed}/`);
  });
}
