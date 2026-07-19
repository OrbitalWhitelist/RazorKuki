import { Router, type IRouter } from "express";
import { botState } from "../bot/status";

const router: IRouter = Router();

router.get("/bot-status", (_req, res): void => {
  res.json({
    online: botState.online,
    tag: botState.tag,
    readyAt: botState.readyAt?.toISOString() ?? null,
  });
});

export default router;
