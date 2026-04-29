import { useEffect, useRef } from "react"
import type { ImageItem } from "../lib/image"
import "./ImageModal.css"

type Props = {
  item: ImageItem
  onClose: () => void
}

export function ImageModal({ item, onClose }: Props) {
  const dialogRef = useRef<HTMLDialogElement>(null)

  useEffect(() => {
    dialogRef.current?.showModal()
    const prev = document.body.style.overflow
    document.body.style.overflow = "hidden"
    return () => {
      document.body.style.overflow = prev
    }
  }, [])

  const handleClick = (e: React.MouseEvent<HTMLDialogElement>) => {
    // dialog 要素自体 (= 背景部分) のクリックで閉じる
    if (e.target === dialogRef.current) onClose()
  }

  const swapped = item.rotation === 90 || item.rotation === 270

  return (
    <dialog
      ref={dialogRef}
      className="image-modal"
      onClose={onClose}
      onClick={handleClick}
      onKeyDown={(e) => e.key === "Escape" && onClose()}
    >
      <button
        type="button"
        onClick={(e) => e.stopPropagation()}
        style={{ background: "none", border: "none", padding: 0, cursor: "default" }}
      >
        <img
          src={item.objectUrl}
          alt=""
          draggable={false}
          style={{
            maxWidth: swapped ? "90vh" : "90vw",
            maxHeight: swapped ? "90vw" : "90vh",
            width: "auto",
            height: "auto",
            transform: `rotate(${item.rotation}deg)`,
            display: "block",
            borderRadius: 6,
            boxShadow: "0 8px 40px rgba(0,0,0,0.5)",
          }}
        />
      </button>
    </dialog>
  )
}
