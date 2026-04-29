import { Data, Effect } from "effect"
import jsPDF from "jspdf"
import type { ImageItem } from "./image"

const A4_WIDTH_MM = 210
const A4_HEIGHT_MM = 297
const PADDING_MM = 10

export class PdfError extends Data.TaggedError("PdfError")<{
  cause?: unknown
  fileName?: string
}> {}

const decodeImage = (file: File): Effect.Effect<ImageBitmap, PdfError> =>
  Effect.tryPromise({
    try: () => createImageBitmap(file),
    catch: (e) => new PdfError({ cause: e, fileName: file.name }),
  })

const drawRotated = (
  ctx: CanvasRenderingContext2D,
  bitmap: ImageBitmap,
  rotation: 0 | 90 | 180 | 270,
): void => {
  const { width, height } = bitmap
  const swapped = rotation === 90 || rotation === 270
  ctx.canvas.width = swapped ? height : width
  ctx.canvas.height = swapped ? width : height
  ctx.save()
  ctx.translate(ctx.canvas.width / 2, ctx.canvas.height / 2)
  ctx.rotate((rotation * Math.PI) / 180)
  ctx.drawImage(bitmap, -width / 2, -height / 2)
  ctx.restore()
}

const calcLayout = (
  w: number,
  h: number,
): { x: number; y: number; w: number; h: number } => {
  const availW = A4_WIDTH_MM - PADDING_MM * 2
  const availH = A4_HEIGHT_MM - PADDING_MM * 2
  const [fw, fh] =
    w / h > availW / availH
      ? [availW, (availW / w) * h]
      : [(availH / h) * w, availH]
  return {
    x: PADDING_MM + (availW - fw) / 2,
    y: PADDING_MM + (availH - fh) / 2,
    w: fw,
    h: fh,
  }
}

const addPageToDoc = (
  doc: jsPDF,
  ctx: CanvasRenderingContext2D,
  item: ImageItem,
  isFirst: boolean,
): Effect.Effect<void, PdfError> =>
  Effect.gen(function* () {
    const bitmap = yield* decodeImage(item.file)
    drawRotated(ctx, bitmap, item.rotation)
    bitmap.close()

    const swapped = item.rotation === 90 || item.rotation === 270
    const layout = calcLayout(
      swapped ? item.height : item.width,
      swapped ? item.width : item.height,
    )

    if (!isFirst) doc.addPage()
    doc.addImage(ctx.canvas, "JPEG", layout.x, layout.y, layout.w, layout.h)
  })

const buildDoc = (items: ImageItem[]): Effect.Effect<jsPDF, PdfError> =>
  Effect.gen(function* () {
    const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" })
    const canvas = document.createElement("canvas")
    const maybeCtx = canvas.getContext("2d")
    if (!maybeCtx) return yield* Effect.fail(new PdfError({ cause: "canvas context unavailable" }))
    const ctx = maybeCtx

    yield* Effect.forEach(
      items,
      (item, i) => addPageToDoc(doc, ctx, item, i === 0),
      { concurrency: 1, discard: true },
    )

    return doc
  })

export const buildPdf = (items: ImageItem[]): Effect.Effect<Uint8Array, PdfError> =>
  buildDoc(items).pipe(Effect.map((doc) => new Uint8Array(doc.output("arraybuffer"))))

export const downloadPdf = (items: ImageItem[]): Effect.Effect<void, PdfError> =>
  buildDoc(items).pipe(Effect.map((doc) => doc.save("result.pdf")))
