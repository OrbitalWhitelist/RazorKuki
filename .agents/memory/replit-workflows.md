---
name: Replit workflow ownership
description: Artifact-owned workflows cannot be removed directly and can auto-start after workspace changes.
---

Artifact-owned workflows are regenerated and may auto-start when the workspace changes, so stopping them is temporary. If an artifact must remain registered but must not execute its service in Replit, retain the validated manifest shape and use a harmless no-op development command.

**Why:** The workflow manager owns artifact services and rejects direct workflow removal; a stopped service can return after edits or dependency changes.

**How to apply:** Treat Termux/PM2 as the only bot runtime and ensure Replit development service commands cannot import or start the Discord client.