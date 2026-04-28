import { Hono } from "hono"

export const api = new Hono<{ Bindings: Env }>()
  .get("/", (c) => c.json({ msg: "API" }))
  .get("/kv", async (c) => {
    const data = await c.env.BOX_REFRESH_TOKEN_CACHE.get("test")
    if (data) {
      return c.text(`loaded data: ${data}`)
    }

    c.env.BOX_REFRESH_TOKEN_CACHE.put("test", "Test Data")
    return c.text("put data")
  })
