/**
 * Legacy settings screen — content has moved:
 *   • Access Codes  → Rooms tab in the main admin section
 *   • Danger Zone   → Rooms tab in the main admin section
 *
 * This screen redirects back to the admin home so any stale deep links
 * or bookmarks land somewhere sensible.
 */
import { Redirect } from 'expo-router';

export default function SettingsRedirect() {
  return <Redirect href="/admin" />;
}
