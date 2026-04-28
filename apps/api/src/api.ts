import { Hono } from "hono"

export const api = new Hono().get("/", (c) => c.json({ msg: "API" }))
