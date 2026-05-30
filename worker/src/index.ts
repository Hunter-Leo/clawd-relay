import { Hono } from "hono";
import type { Env } from "./types";

const app = new Hono<{ Bindings: Env }>();

app.get("/", (c) => c.text("Clawd Relay Worker — OK"));

export default app;
