import { useSortable } from "@dnd-kit/sortable"
import { CSS } from "@dnd-kit/utilities"
import type React from "react"
import type { ImageItem } from "../lib/image"

type Props = {
  item: ImageItem
  onRotate: (id: string, dir: 1 | -1) => void
}

const CARD_WIDTH = 160

export function ImageCard({ item, onRotate }: Props) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id: item.id })

  return (
    <div
      ref={setNodeRef}
      style={{
        transform: CSS.Transform.toString(transform),
        transition,
        opacity: isDragging ? 0.4 : 1,
        width: CARD_WIDTH,
        background: "#fff",
        borderRadius: 8,
        boxShadow: "0 1px 4px rgba(0,0,0,0.10)",
        overflow: "hidden",
        userSelect: "none",
        display: "flex",
        flexDirection: "column",
      }}
    >
      <div
        {...attributes}
        {...listeners}
        title="ドラッグして並び替え"
        style={{
          height: 24,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          cursor: isDragging ? "grabbing" : "grab",
          color: "#bbb",
          fontSize: 16,
          background: "#fafafa",
          borderBottom: "1px solid #eee",
          touchAction: "none",
          letterSpacing: 2,
        }}
      >
        ⠿
      </div>

      <div
        style={{
          width: CARD_WIDTH,
          height: CARD_WIDTH,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "#f0f0f0",
          overflow: "hidden",
        }}
      >
        <img
          src={item.objectUrl}
          alt={item.file.name}
          draggable={false}
          style={{
            width: "100%",
            height: "100%",
            objectFit: "contain",
            transform: `rotate(${item.rotation}deg)`,
            transformBox: "fill-box",
          }}
        />
      </div>

      <div
        style={{
          display: "flex",
          alignItems: "center",
          padding: "5px 6px",
          gap: 4,
          borderTop: "1px solid #eee",
        }}
      >
        <button type="button" onClick={() => onRotate(item.id, -1)} style={rotateBtnStyle} title="左に回転">
          ↺
        </button>
        <span
          style={{
            flex: 1,
            fontSize: 11,
            color: "#777",
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
            textAlign: "center",
          }}
        >
          {item.file.name}
        </span>
        <button type="button" onClick={() => onRotate(item.id, 1)} style={rotateBtnStyle} title="右に回転">
          ↻
        </button>
      </div>
    </div>
  )
}

const rotateBtnStyle: React.CSSProperties = {
  width: 28,
  height: 28,
  padding: 0,
  border: "none",
  background: "transparent",
  cursor: "pointer",
  fontSize: 16,
  borderRadius: 4,
  color: "#555",
  flexShrink: 0,
  lineHeight: 1,
}
