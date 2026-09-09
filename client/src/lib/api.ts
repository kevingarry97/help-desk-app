import axios from "axios";

/**
 * Same-origin by design: Vite proxies /api to the Express server (see vite.config.ts), so
 * the browser sees one origin and the session cookie rides along without CORS in the way.
 */
export const api = axios.create({ baseURL: "/api" });
