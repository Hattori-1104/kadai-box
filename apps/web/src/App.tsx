import jsPDF from "jspdf"
import { type ChangeEvent, useState } from "react"

type ImageData = {
  dataUrl: Base64URLString
  name: string
  width: number
  height: number
}

const A4WIDTH = 210
const A4HEIGHT = 297

export default function App() {
  const [imageDataArray, setImageDataArray] = useState<ImageData[]>([])

  const handleInputFile = (e: ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files
    if (!files) {
      return
    }

    const fileArray = Array.from(files)

    setImageDataArray([])
    for (const file of fileArray) {
      const reader = new FileReader()
      reader.onloadend = () => {
        const dataUrl = reader.result
        if (typeof dataUrl !== "string") {
          return
        }
        const img = new Image()
        img.src = dataUrl
        const imageData: ImageData = {
          dataUrl,
          name: file.name,
          width: img.width,
          height: img.height,
        }

        setImageDataArray((prev) => [...prev, imageData])
      }
      reader.readAsDataURL(file)
    }
  }

  const handleDownload = () => {
    const doc = new jsPDF({
      orientation: "portrait",
      unit: "mm",
      format: "a4",
    })

    const canvas = document.createElement("canvas")
    const ctx = canvas.getContext("2d")
    if (!ctx) return

    for (const imageData of imageDataArray) {
      console.log(imageData)
      const padding = 10

      const pdfWidthAvailable = doc.internal.pageSize.getWidth() - padding * 2
      const pdfHeightAvailable = doc.internal.pageSize.getHeight() - padding * 2
      const pdfAspectRatio = pdfWidthAvailable / pdfHeightAvailable

      const imageWidth = imageData.width
      const imageHeight = imageData.height
      const imageAspectRatio = imageWidth / imageHeight

      let imageWidthInPage: number
      let imageHeightInPage: number
      if (pdfAspectRatio < imageAspectRatio) {
        const scale = pdfWidthAvailable / imageWidth
        imageWidthInPage = imageWidth * scale
        imageHeightInPage = imageHeight * scale
      } else {
        const scale = pdfHeightAvailable / imageHeight
        imageWidthInPage = imageHeight * scale
        imageHeightInPage = imageHeight * scale
      }

      // console.log({ imageWidth, imageHeight })
      canvas.width = imageWidth
      canvas.height = imageHeight
      const image = new Image()
      image.src = imageData.dataUrl
      ctx.drawImage(image, 0, 0)

      doc.addImage(
        canvas,
        "JPEG",
        padding,
        padding,
        imageWidthInPage,
        imageHeightInPage,
      )
      doc.addPage()
    }
    doc.save("result.pdf")
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
        {imageDataArray.map((image) => (
          <div key={image.name}>
            <img src={image.dataUrl} alt="" />
          </div>
        ))}
      </div>
      <button type="button" onClick={handleDownload}>
        Download
      </button>
    </div>
  )
}
