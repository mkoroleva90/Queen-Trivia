// Admin access code settings endpoints removed.
// Host authentication is email/password + SSO only; the admin_settings table
// is retained but no longer written or read by the API.

import { Router } from "express";

const router = Router();

export default router;
