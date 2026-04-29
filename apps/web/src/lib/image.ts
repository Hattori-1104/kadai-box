import { Data, Effect } from "effect"

export type ImageItem = {
  id: string
  file: File
  objectUrl: string
  width: number
  height: number
  rotation: 0 | 90 | 180 | 270
}

export class ImageLoadError extends Data.TaggedError("ImageLoadError")<{
  fileName: string
  cause?: unknown
}> {}

const getImageDimensions = (
  url: string,
): Effect.Effect<{ width: number; height: number }, unknown> =>
  Effect.async((resume) => {
    const img = new Image()
    img.onload = () => resume(Effect.succeed({ width: img.width, height: img.height }))
    img.onerror = (e) => resume(Effect.fail(e))
    img.src = url
  })

export const loadImageItem = (file: File): Effect.Effect<ImageItem, ImageLoadError> =>
  Effect.gen(function* () {
    const objectUrl = URL.createObjectURL(file)
    const { width, height } = yield* getImageDimensions(objectUrl).pipe(
      Effect.mapError((cause) => new ImageLoadError({ fileName: file.name, cause })),
    )
    return {
      id: crypto.randomUUID?.() ?? Math.random().toString(36).slice(2) + Date.now().toString(36),
      file,
      objectUrl,
      width,
      height,
      rotation: 0 as const,
    }
  })

export const loadImageItems = (
  files: File[],
): Effect.Effect<ImageItem[], ImageLoadError> =>
  Effect.all(files.map(loadImageItem), { concurrency: "unbounded" })

export const revokeObjectUrl = (item: ImageItem): void => {
  URL.revokeObjectURL(item.objectUrl)
}
