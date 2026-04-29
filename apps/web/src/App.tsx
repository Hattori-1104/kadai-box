import {
  DndContext,
  type DragEndEvent,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
} from "@dnd-kit/core"
import { SortableContext, arrayMove, rectSortingStrategy } from "@dnd-kit/sortable"
import { Cause, Effect, Exit, Option } from "effect"
import { type ChangeEvent, useEffect, useRef, useState } from "react"
import type React from "react"
import { ImageCard } from "./components/ImageCard"
import { ImageModal } from "./components/ImageModal"
import { type ImageItem, type ImageLoadError, loadImageItems, revokeObjectUrl } from "./lib/image"
import { type PdfError, buildPdf, downloadPdf } from "./lib/pdf"

const formatImageError = (e: ImageLoadError): string =>
  `"${e.fileName}" の読み込みに失敗しました`

const formatPdfError = (e: PdfError): string => {
  if (e.fileName) return `"${e.fileName}" の変換に失敗しました`
  if (typeof e.cause === "string") return e.cause
  if (e.cause instanceof Error) return e.cause.message
  return "PDF の生成に失敗しました"
}

// typed failure のほか、予期せぬ例外 (defect) も文字列として取り出す
const extractCauseMessage = <E,>(
  cause: Cause.Cause<E>,
  formatFailure: (e: E) => string,
): string => {
  const failure = Option.getOrUndefined(Cause.failureOption(cause))
  if (failure !== undefined) return formatFailure(failure)
  const defect = Cause.squash(cause)
  return defect instanceof Error ? defect.message : String(defect)
}

export default function App() {
  const [items, setItems] = useState<ImageItem[]>([])
  const [error, setError] = useState<string | null>(null)
  const [previewId, setPreviewId] = useState<string | null>(null)
  const [savedPdf, setSavedPdf] = useState<Uint8Array | null>(null)
  const itemsRef = useRef(items)
  const inputRef = useRef<HTMLInputElement>(null)
  itemsRef.current = items

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
  )

  useEffect(() => {
    return () => {
      for (const item of itemsRef.current) revokeObjectUrl(item)
    }
  }, [])

  const handleInputFile = async (e: ChangeEvent<HTMLInputElement>) => {
    // iOS Safari は非同期処理中に e.target.files をクリアすることがあるため先に Array へコピーする
    const files = Array.from(e.target.files ?? [])
    if (files.length === 0) return
    setError(null)
    for (const item of itemsRef.current) revokeObjectUrl(item)
    const exit = await Effect.runPromiseExit(loadImageItems(files))
    if (Exit.isSuccess(exit)) {
      setItems(exit.value)
      setSavedPdf(null)
    } else {
      setError(extractCauseMessage(exit.cause, formatImageError))
    }
  }

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event
    if (!over || active.id === over.id) return
    setSavedPdf(null)
    setItems((prev) => {
      const from = prev.findIndex((i) => i.id === active.id)
      const to = prev.findIndex((i) => i.id === over.id)
      return arrayMove(prev, from, to)
    })
  }

  const handleRotate = (id: string, dir: 1 | -1) => {
    setSavedPdf(null)
    setItems((prev) =>
      prev.map((item) =>
        item.id === id
          ? {
              ...item,
              rotation: ((item.rotation + dir * 90 + 360) % 360) as 0 | 90 | 180 | 270,
            }
          : item,
      ),
    )
  }

  const handleSave = async () => {
    setError(null)
    const exit = await Effect.runPromiseExit(buildPdf(items))
    if (Exit.isSuccess(exit)) {
      setSavedPdf(exit.value)
    } else {
      setError(extractCauseMessage(exit.cause, formatPdfError))
    }
  }

  const handleDownload = async () => {
    setError(null)
    const exit = await Effect.runPromiseExit(downloadPdf(items))
    if (Exit.isFailure(exit)) {
      setError(extractCauseMessage(exit.cause, formatPdfError))
    }
  }

  return (
    <div style={layoutStyle}>
      <h1 style={titleStyle}>Image to PDF</h1>

      {/* display:none だと iOS Safari で onChange が発火しないため opacity+absolute で隠す */}
      <input
        ref={inputRef}
        type="file"
        multiple
        accept="image/jpeg, image/png"
        onChange={handleInputFile}
        style={{ position: "absolute", opacity: 0, width: 0, height: 0, pointerEvents: "none" }}
      />
      <button type="button" onClick={() => inputRef.current?.click()} style={uploadBtnStyle}>
        {items.length === 0
          ? "クリックして画像を選択 (JPEG / PNG)"
          : `${items.length} 枚選択中 — クリックして変更`}
      </button>

      {error && <p style={errorStyle}>{error}</p>}

      {items.length > 0 && (
        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragEnd={handleDragEnd}
        >
          <SortableContext items={items.map((i) => i.id)} strategy={rectSortingStrategy}>
            <div style={gridStyle}>
              {items.map((item, i) => (
                <ImageCard
                  key={item.id}
                  item={item}
                  index={i}
                  onRotate={handleRotate}
                  onPreview={setPreviewId}
                />
              ))}
            </div>
          </SortableContext>
        </DndContext>
      )}

      {previewId && (() => {
        const item = items.find((i) => i.id === previewId)
        return item ? <ImageModal item={item} onClose={() => setPreviewId(null)} /> : null
      })()}

      <div style={actionRowStyle}>
        <button
          type="button"
          onClick={handleSave}
          disabled={items.length === 0}
          style={items.length === 0 ? { ...saveBtnStyle, ...btnDisabledStyle } : saveBtnStyle}
        >
          PDF として保存
        </button>
        <button
          type="button"
          onClick={handleDownload}
          disabled={items.length === 0}
          style={items.length === 0 ? { ...downloadBtnStyle, ...btnDisabledStyle } : downloadBtnStyle}
        >
          ダウンロード
        </button>
      </div>

      {savedPdf && (
        <p style={savedStatusStyle}>
          PDF を保存しました（{(savedPdf.byteLength / 1024).toFixed(0)} KB）
        </p>
      )}
    </div>
  )
}

const layoutStyle: React.CSSProperties = {
  maxWidth: 900,
  margin: "0 auto",
  padding: "40px 24px",
  fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
}

const titleStyle: React.CSSProperties = {
  fontSize: 26,
  fontWeight: 700,
  margin: "0 0 28px",
  color: "#111",
}

const uploadBtnStyle: React.CSSProperties = {
  display: "block",
  marginBottom: 28,
  padding: "12px 20px",
  background: "#fff",
  border: "2px dashed #d0d0d0",
  borderRadius: 8,
  fontSize: 14,
  color: "#555",
  cursor: "pointer",
}

const gridStyle: React.CSSProperties = {
  display: "flex",
  flexWrap: "wrap",
  gap: 16,
  marginBottom: 32,
}

const actionRowStyle: React.CSSProperties = {
  display: "flex",
  gap: 12,
  flexWrap: "wrap",
}

const saveBtnStyle: React.CSSProperties = {
  padding: "12px 28px",
  background: "#fff",
  color: "#111",
  border: "2px solid #111",
  borderRadius: 8,
  fontSize: 15,
  fontWeight: 600,
  cursor: "pointer",
}

const downloadBtnStyle: React.CSSProperties = {
  padding: "12px 28px",
  background: "#111",
  color: "#fff",
  border: "2px solid #111",
  borderRadius: 8,
  fontSize: 15,
  fontWeight: 600,
  cursor: "pointer",
}

const btnDisabledStyle: React.CSSProperties = {
  background: "#eee",
  color: "#aaa",
  borderColor: "#ddd",
  cursor: "not-allowed",
}

const savedStatusStyle: React.CSSProperties = {
  marginTop: 12,
  fontSize: 13,
  color: "#166534",
}

const errorStyle: React.CSSProperties = {
  margin: "0 0 20px",
  padding: "10px 16px",
  background: "#fff0f0",
  border: "1px solid #fca5a5",
  borderRadius: 6,
  color: "#b91c1c",
  fontSize: 14,
}
