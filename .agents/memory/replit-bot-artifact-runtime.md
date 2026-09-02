---
name: Replit bot artifact runtime
description: Bot-only API artifacts still need a minimal health listener when published through a managed port-based artifact workflow.
---

A Discord-only process can connect successfully but still be marked failed by Replit if its artifact manifest expects a service port. Keep the bot logic independent from HTTP and use only a minimal health listener when the Replit runtime provides PORT; omit PORT in Termux PM2 so the phone process remains bot-only.

**Why:** The managed artifact workflow waits for its declared port before considering startup successful, even when the actual application is a Discord gateway client.

**How to apply:** When publishing this bot artifact, verify both the liveness port and Discord login. For Termux, avoid setting PORT unless an external monitor genuinely needs the listener.