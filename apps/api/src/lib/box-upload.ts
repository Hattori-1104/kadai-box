import { Data, Effect } from "effect"

const BOX_API_BASE = "https://api.box.com/2.0"
const BOX_UPLOAD_BASE = "https://upload.box.com/api/2.0"
const KADAI_FOLDER_NAME = "課題ボックス"

// ── Errors ────────────────────────────────────────────────────────────────────

export class BoxUploadError extends Data.TaggedError("BoxUploadError")<{
  message: string
}> {}

// ── Types ─────────────────────────────────────────────────────────────────────

type BoxFolder = {
  id: string
  name: string
}

type BoxFile = {
  id: string
  name: string
}

// ── Folder ────────────────────────────────────────────────────────────────────

// POST /2.0/folders でフォルダ作成を試みる。
// 409（同名フォルダ既存）の場合は context_info.conflicts から既存 ID を返す。
export const getOrCreateKadaiBoxFolder = (
  accessToken: string,
): Effect.Effect<string, BoxUploadError> =>
  Effect.tryPromise({
    try: async () => {
      const res = await fetch(`${BOX_API_BASE}/folders`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          name: KADAI_FOLDER_NAME,
          parent: { id: "0" },
        }),
      })

      if (res.ok) {
        const data = (await res.json()) as BoxFolder
        return data.id
      }

      if (res.status === 409) {
        const data = (await res.json()) as {
          context_info: { conflicts: BoxFolder[] }
        }
        const conflict = data.context_info?.conflicts?.[0]
        if (conflict?.id) return conflict.id
        throw new Error("Conflict response missing folder id")
      }

      throw new Error(`Create folder failed: ${res.status} ${await res.text()}`)
    },
    catch: (e) => new BoxUploadError({ message: String(e) }),
  })

// ── Upload ────────────────────────────────────────────────────────────────────

export const uploadPdfToBox = (
  folderId: string,
  fileName: string,
  pdfBytes: Uint8Array,
  accessToken: string,
): Effect.Effect<BoxFile, BoxUploadError> =>
  Effect.tryPromise({
    try: async () => {
      const form = new FormData()
      form.append(
        "attributes",
        JSON.stringify({ name: fileName, parent: { id: folderId } }),
      )
      form.append(
        "file",
        new Blob([pdfBytes], { type: "application/pdf" }),
        fileName,
      )

      const res = await fetch(`${BOX_UPLOAD_BASE}/files/content`, {
        method: "POST",
        headers: { Authorization: `Bearer ${accessToken}` },
        body: form,
      })

      if (!res.ok) throw new Error(`Upload failed: ${res.status} ${await res.text()}`)

      const data = (await res.json()) as { entries: BoxFile[] }
      const entry = data.entries?.[0]
      if (!entry) throw new Error("Upload response missing file entry")
      return entry
    },
    catch: (e) => new BoxUploadError({ message: String(e) }),
  })
