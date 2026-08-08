/**
 * Single source of truth for the API base URL used by every mobile screen,
 * context, and socket hook.
 *
 * In development, EXPO_PUBLIC_DOMAIN is injected by the Expo dev server
 * (pointing at the Replit preview domain). In production EAS builds it is
 * set to queen-trivia.com via eas.json. If the variable is missing or empty
 * for any reason, this falls back to the production domain so a missing
 * setting never produces a silently blank address.
 */

const PRODUCTION_URL = 'https://queen-trivia.com';
const domain = process.env.EXPO_PUBLIC_DOMAIN;

export const API_BASE_URL: string = domain ? `https://${domain}` : PRODUCTION_URL;
