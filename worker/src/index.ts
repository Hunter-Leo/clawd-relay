import { Hono } from "hono";
import type { Env } from "./types";
import { RelayRoom } from "./durable-object";

const app = new Hono<{ Bindings: Env }>();

app.get("/", (c) => c.text("Clawd Relay Worker — OK"));

export { RelayRoom };
export default app;
