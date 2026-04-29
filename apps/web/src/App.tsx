import { Effect } from "effect"
import { type ChangeEvent, useEffect, useRef, useState } from "react"
import { type ImageItem, loadImageItems, revokeObjectUrl } from "./lib/image"
import { generatePdf } from "./lib/pdf"

export default function App() {
  const [items, setItems] = useState<ImageItem[]>([])
  const itemsRef = useRef(items)
  itemsRef.current = items

  useEffect(() => {
    return () => {
      for (const item of itemsRef.current) revokeObjectUrl(item)
    }
  }, [])

  const handleInputFile = async (e: ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files
    if (!files) return
    for (const item of itemsRef.current) revokeObjectUrl(item)
    const loaded = await Effect.runPromise(loadImageItems(files))
    setItems(loaded)
  }

  const handleDownload = () => {
    Effect.runPromise(generatePdf(items)).catch(console.error)
  }

  return (
    <div>
      <h1>Upload image</h1>
      <input
        type="file"
        multiple
        accept="image/jpeg, image/png"
        onChange={handleInputFile}
      />
      <div>
        {items.map((item) => (
          <div key={item.id}>
            <img
              src={item.objectUrl}
              alt={item.file.name}
              style={{ transform: `rotate(${item.rotation}deg)` }}
            />
          </div>
        ))}
      </div>
      <button type="button" onClick={handleDownload}>
        Download
      </button>
    </div>
  )
}
