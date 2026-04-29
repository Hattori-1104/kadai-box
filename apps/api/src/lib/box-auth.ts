import { Cause, Data, Effect, Exit, Option } from "effect"

const BOX_AUTH_BASE = "https://account.box.com/api/oauth2/authorize"
const BOX_TOKEN_URL = "https://api.box.com/oauth2/token"
const BOX_USER_URL = "https://api.box.com/2.0/users/me"

const ACCESS_TOKEN_TTL = 60 * 60 // 1 hour — matches Box's token lifetime
const SESSION_TTL = 60 * 60 * 24 * 30 // 30 days

// ── Errors ────────────────────────────────────────────────────────────────────

export class BoxAuthError extends Data.TaggedError("BoxAuthError")<{
  message: string
}> {}

export class BoxTokenError extends Data.TaggedError("BoxTokenError")<{
  message: string
}> {}

export class StateError extends Data.TaggedError("StateError")<{
  message: string
}> {}

export class SessionError extends Data.TaggedError("SessionError")<{
  message: string
}> {}

export class UserNotFoundError extends Data.TaggedError("UserNotFoundError")<{
  userId: string
}> {}

// ── Types ─────────────────────────────────────────────────────────────────────

type BoxTokens = {
  access_token: string
  refresh_token: string
  expires_in: number
}

type BoxUser = {
  id: string
  name: string
  login: string // email
}

// ── State (CSRF) ──────────────────────────────────────────────────────────────

export const generateState = (): string => crypto.randomUUID()

export const saveState = (
  state: string,
  db: D1Database,
): Effect.Effect<void, BoxAuthError> =>
  Effect.tryPromise({
    try: () =>
      db
        .prepare("INSERT INTO oauth_states (state) VALUES (?)")
        .bind(state)
        .run(),
    catch: (e) => new BoxAuthError({ message: String(e) }),
  }).pipe(Effect.asVoid)

export const verifyAndDeleteState = (
  state: string,
  db: D1Database,
): Effect.Effect<void, StateError> =>
  Effect.tryPromise({
    try: () =>
      db
        .prepare("SELECT state FROM oauth_states WHERE state = ?")
        .bind(state)
        .first(),
    catch: (e) => new StateError({ message: String(e) }),
  }).pipe(
    Effect.flatMap((row) =>
      row === null
        ? Effect.fail(new StateError({ message: "Invalid or expired state" }))
        : Effect.tryPromise({
            try: () =>
              db
                .prepare("DELETE FROM oauth_states WHERE state = ?")
                .bind(state)
                .run(),
            catch: (e) => new StateError({ message: String(e) }),
          }).pipe(Effect.asVoid),
    ),
  )

// ── Box OAuth ─────────────────────────────────────────────────────────────────

export const buildAuthUrl = (state: string, env: Env): string => {
  const params = new URLSearchParams({
    response_type: "code",
    client_id: env.BOX_CLIENT_ID,
    redirect_uri: env.BOX_REDIRECT_URI,
    state,
  })
  return `${BOX_AUTH_BASE}?${params}`
}

export const exchangeCode = (
  code: string,
  env: Env,
): Effect.Effect<BoxTokens, BoxTokenError> =>
  Effect.tryPromise({
    try: async () => {
      const res = await fetch(BOX_TOKEN_URL, {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({
          grant_type: "authorization_code",
          code,
          client_id: env.BOX_CLIENT_ID,
          client_secret: env.BOX_CLIENT_SECRET,
          redirect_uri: env.BOX_REDIRECT_URI,
        }),
      })
      if (!res.ok) throw new Error(await res.text())
      return res.json() as Promise<BoxTokens>
    },
    catch: (e) => new BoxTokenError({ message: String(e) }),
  })

const refreshTokens = (
  refreshToken: string,
  env: Env,
): Effect.Effect<BoxTokens, BoxTokenError> =>
  Effect.tryPromise({
    try: async () => {
      const res = await fetch(BOX_TOKEN_URL, {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({
          grant_type: "refresh_token",
          refresh_token: refreshToken,
          client_id: env.BOX_CLIENT_ID,
          client_secret: env.BOX_CLIENT_SECRET,
        }),
      })
      if (!res.ok) throw new Error(await res.text())
      return res.json() as Promise<BoxTokens>
    },
    catch: (e) => new BoxTokenError({ message: String(e) }),
  })

const fetchBoxUser = (
  accessToken: string,
): Effect.Effect<BoxUser, BoxAuthError> =>
  Effect.tryPromise({
    try: async () => {
      const res = await fetch(BOX_USER_URL, {
        headers: { Authorization: `Bearer ${accessToken}` },
      })
      if (!res.ok) throw new Error(`status ${res.status}`)
      return res.json() as Promise<BoxUser>
    },
    catch: (e) => new BoxAuthError({ message: String(e) }),
  })

// ── User ──────────────────────────────────────────────────────────────────────

// Returns internal user ID. Box rotates refresh_token on every token exchange,
// so we always overwrite it.
export const upsertUser = (
  tokens: BoxTokens,
  db: D1Database,
): Effect.Effect<string, BoxAuthError> =>
  fetchBoxUser(tokens.access_token).pipe(
    Effect.flatMap((boxUser) =>
      Effect.tryPromise({
        try: () =>
          db
            .prepare("SELECT id FROM users WHERE box_user_id = ?")
            .bind(boxUser.id)
            .first<{ id: string }>(),
        catch: (e) => new BoxAuthError({ message: String(e) }),
      }).pipe(
        Effect.flatMap((existing) => {
          if (existing) {
            return Effect.tryPromise({
              try: () =>
                db
                  .prepare(
                    `UPDATE users
                     SET refresh_token = ?, token_updated_at = CURRENT_TIMESTAMP
                     WHERE id = ?`,
                  )
                  .bind(tokens.refresh_token, existing.id)
                  .run()
                  .then(() => existing.id),
              catch: (e) => new BoxAuthError({ message: String(e) }),
            })
          }
          const id = crypto.randomUUID()
          return Effect.tryPromise({
            try: () =>
              db
                .prepare(
                  `INSERT INTO users (id, box_user_id, email, display_name, refresh_token, token_updated_at)
                   VALUES (?, ?, ?, ?, ?, CURRENT_TIMESTAMP)`,
                )
                .bind(
                  id,
                  boxUser.id,
                  boxUser.login,
                  boxUser.name,
                  tokens.refresh_token,
                )
                .run()
                .then(() => id),
            catch: (e) => new BoxAuthError({ message: String(e) }),
          })
        }),
      ),
    ),
  )

// ── Access Token (KV cached) ──────────────────────────────────────────────────

export const getAccessToken = (
  userId: string,
  env: Env,
): Effect.Effect<string, BoxTokenError | UserNotFoundError> =>
  Effect.tryPromise({
    try: (): Promise<string | null> =>
      env.BOX_REFRESH_TOKEN_CACHE.get(`access_token:${userId}`),
    catch: (e) => new BoxTokenError({ message: String(e) }),
  }).pipe(
    Effect.flatMap((cached) => {
      if (cached !== null) return Effect.succeed(cached)

      return Effect.tryPromise({
        try: () =>
          env.KADAI_BOX_DB.prepare(
            "SELECT refresh_token FROM users WHERE id = ?",
          )
            .bind(userId)
            .first<{ refresh_token: string }>(),
        catch: (e) => new BoxTokenError({ message: String(e) }),
      }).pipe(
        Effect.flatMap(
          (user): Effect.Effect<string, BoxTokenError | UserNotFoundError> => {
            if (user === null)
              return Effect.fail(new UserNotFoundError({ userId }))
            return refreshTokens(user.refresh_token, env).pipe(
              Effect.flatMap((tokens) =>
                Effect.tryPromise({
                  try: async () => {
                    await env.KADAI_BOX_DB.prepare(
                      `UPDATE users
                         SET refresh_token = ?, token_updated_at = CURRENT_TIMESTAMP
                         WHERE id = ?`,
                    )
                      .bind(tokens.refresh_token, userId)
                      .run()
                    await env.BOX_REFRESH_TOKEN_CACHE.put(
                      `access_token:${userId}`,
                      tokens.access_token,
                      { expirationTtl: ACCESS_TOKEN_TTL },
                    )
                    return tokens.access_token
                  },
                  catch: (e) => new BoxTokenError({ message: String(e) }),
                }),
              ),
            )
          },
        ),
      )
    }),
  )

// ── Session (KV) ──────────────────────────────────────────────────────────────

export const createSession = (
  userId: string,
  env: Env,
): Effect.Effect<string, BoxAuthError> =>
  Effect.tryPromise({
    try: async () => {
      const sessionId = crypto.randomUUID()
      await env.BOX_REFRESH_TOKEN_CACHE.put(`session:${sessionId}`, userId, {
        expirationTtl: SESSION_TTL,
      })
      return sessionId
    },
    catch: (e) => new BoxAuthError({ message: String(e) }),
  })

export const getSessionUserId = (
  sessionId: string,
  env: Env,
): Effect.Effect<string, SessionError> =>
  Effect.tryPromise({
    try: () => env.BOX_REFRESH_TOKEN_CACHE.get(`session:${sessionId}`),
    catch: (e) => new SessionError({ message: String(e) }),
  }).pipe(
    Effect.flatMap((userId) =>
      userId === null
        ? Effect.fail(
            new SessionError({ message: "Session not found or expired" }),
          )
        : Effect.succeed(userId),
    ),
  )

export const deleteSession = (
  sessionId: string,
  env: Env,
): Effect.Effect<void, BoxAuthError> =>
  Effect.tryPromise({
    try: () => env.BOX_REFRESH_TOKEN_CACHE.delete(`session:${sessionId}`),
    catch: (e) => new BoxAuthError({ message: String(e) }),
  }).pipe(Effect.asVoid)

// ── Re-export for use in routes ───────────────────────────────────────────────

export { Cause, Exit, Option }
