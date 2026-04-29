import { Effect } from "effect"
import { Hono } from "hono"
import { deleteCookie, getCookie, setCookie } from "hono/cookie"
import {
  BoxAuthError,
  Cause,
  Exit,
  Option,
  StateError,
  buildAuthUrl,
  createSession,
  deleteSession,
  exchangeCode,
  generateState,
  getSessionUserId,
  saveState,
  upsertUser,
  verifyAndDeleteState,
} from "./lib/box-auth"

const SESSION_COOKIE = "sid"
const COOKIE_MAX_AGE = 60 * 60 * 24 * 30 // 30 days

export const api = new Hono<{ Bindings: Env }>()

  // GET /api/auth/box — redirect to Box OAuth authorization page
  .get("/auth/box", async (c) => {
    const state = generateState()
    const exit = await Effect.runPromiseExit(saveState(state, c.env.KADAI_BOX_DB))
    if (Exit.isFailure(exit)) {
      console.error(Cause.squash(exit.cause))
      return c.json({ error: "Failed to initiate OAuth" }, 500)
    }
    return c.redirect(buildAuthUrl(state, c.env))
  })

  // GET /api/auth/box/callback — exchange code for tokens, create session
  .get("/auth/box/callback", async (c) => {
    const { code, state, error } = c.req.query()

    if (error || !code || !state) {
      return c.json({ error: error ?? "Missing code or state" }, 400)
    }

    const exit = await Effect.runPromiseExit(
      verifyAndDeleteState(state, c.env.KADAI_BOX_DB).pipe(
        Effect.flatMap(() => exchangeCode(code, c.env)),
        Effect.flatMap((tokens) => upsertUser(tokens, c.env.KADAI_BOX_DB)),
        Effect.flatMap((userId) => createSession(userId, c.env)),
      ),
    )

    if (Exit.isFailure(exit)) {
      const err = Cause.failureOption(exit.cause)
      if (Option.isSome(err) && err.value instanceof StateError) {
        return c.json({ error: err.value.message }, 400)
      }
      console.error(Cause.squash(exit.cause))
      return c.json({ error: "Authentication failed" }, 500)
    }

    setCookie(c, SESSION_COOKIE, exit.value, {
      httpOnly: true,
      secure: true,
      sameSite: "Lax",
      maxAge: COOKIE_MAX_AGE,
      path: "/",
    })

    return c.redirect("/")
  })

  // GET /api/auth/me — return current authenticated user
  .get("/auth/me", async (c) => {
    const sessionId = getCookie(c, SESSION_COOKIE)
    if (!sessionId) return c.json({ error: "Not authenticated" }, 401)

    const exit = await Effect.runPromiseExit(
      getSessionUserId(sessionId, c.env).pipe(
        Effect.flatMap((userId) =>
          Effect.tryPromise({
            try: () =>
              c.env.KADAI_BOX_DB.prepare(
                "SELECT id, box_user_id, email, display_name FROM users WHERE id = ?",
              )
                .bind(userId)
                .first(),
            catch: (e) => new BoxAuthError({ message: String(e) }),
          }),
        ),
      ),
    )

    if (Exit.isFailure(exit) || exit.value === null) {
      return c.json({ error: "Not authenticated" }, 401)
    }

    return c.json({ user: exit.value })
  })

  // POST /api/auth/logout — delete session
  .post("/auth/logout", async (c) => {
    const sessionId = getCookie(c, SESSION_COOKIE)
    if (sessionId) {
      await Effect.runPromise(
        deleteSession(sessionId, c.env).pipe(Effect.catchAll(() => Effect.void)),
      )
    }
    deleteCookie(c, SESSION_COOKIE, { path: "/" })
    return c.json({ ok: true })
  })
