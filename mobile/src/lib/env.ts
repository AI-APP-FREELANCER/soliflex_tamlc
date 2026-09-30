// EXPO_PUBLIC_-prefixed vars are statically inlined into the JS bundle by
// Expo at build time. Defaults to the one real backend this whole project
// talks to (backend/ + frontend/ both point at the same DigitalOcean-hosted
// Postgres via this same API).
export const API_BASE_URL = process.env.EXPO_PUBLIC_API_BASE_URL ?? "https://tms.soliflexpackaging.com/api";
