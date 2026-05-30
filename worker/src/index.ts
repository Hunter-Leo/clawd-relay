import { Hono } from "hono";

const app = new Hono<{ Bindings: Env }>();

app.get("/", (c) => c.text("Clawd Relay Worker — OK"));

export default app;

interface Env {
  RELAY_ROOM: DurableObjectNamespace;
}
