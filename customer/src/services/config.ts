/**
 * Service-layer configuration.
 *
 * While `USE_MOCK_API` is true every service resolves against the in-browser
 * mock database. Once the Node.js + Supabase API is live, set
 * VITE_USE_MOCK_API=false and VITE_API_URL — each service already contains the
 * matching HTTP call, so no UI code needs to change.
 */
export const API_URL = (import.meta.env.VITE_API_URL as string | undefined)?.replace(/\/$/, '') ?? '';

export const USE_MOCK_API = (import.meta.env.VITE_USE_MOCK_API as string | undefined) !== 'false' || !API_URL;
