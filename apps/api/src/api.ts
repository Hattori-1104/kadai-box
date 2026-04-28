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
  .get("/d1", async (c) => {
    const result = await c.env.KADAI_BOX_DB.prepare("SELECT * FROM users").run()
    return c.json({ result })
  })
