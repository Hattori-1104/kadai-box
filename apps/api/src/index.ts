import { Hono } from "hono"
import { api } from "./api"

const app = new Hono<{ Bindings: Env }>().route("/api", api).use("*", (c) => {
  const url = new URL(c.req.url)
  url.pathname = "index.html"
  return c.env.ASSETS.fetch(url)
})

export default app
