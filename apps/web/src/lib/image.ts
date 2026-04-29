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
  cause?: unknown
}> {}

const getImageDimensions = (
  url: string,
): Effect.Effect<{ width: number; height: number }, ImageLoadError> =>
  Effect.async((resume) => {
    const img = new Image()
    img.onload = () => resume(Effect.succeed({ width: img.width, height: img.height }))
    img.onerror = (e) => resume(Effect.fail(new ImageLoadError({ cause: e })))
    img.src = url
  })

export const loadImageItem = (file: File): Effect.Effect<ImageItem, ImageLoadError> =>
  Effect.gen(function* () {
    const objectUrl = URL.createObjectURL(file)
    const { width, height } = yield* getImageDimensions(objectUrl)
    return {
      id: crypto.randomUUID(),
      file,
      objectUrl,
      width,
      height,
      rotation: 0 as const,
    }
  })

export const loadImageItems = (
  files: FileList,
): Effect.Effect<ImageItem[], ImageLoadError> =>
  Effect.all(Array.from(files).map(loadImageItem), { concurrency: "unbounded" })

export const revokeObjectUrl = (item: ImageItem): void => {
  URL.revokeObjectURL(item.objectUrl)
}
