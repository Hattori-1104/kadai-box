#!/usr/bin/env bun
import { join } from "node:path"
import { deflateSync } from "node:zlib"

const WIDTH = 192
const HEIGHT = 192
const COLOR = { r: 99, g: 102, b: 241 } // indigo-500

const CRC_TABLE = (() => {
  const t = new Uint32Array(256)
  for (let n = 0; n < 256; n++) {
    let c = n
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1
    t[n] = c
  }
  return t
})()

function crc32(data: Uint8Array): number {
  let crc = 0xffffffff
  for (const b of data) crc = (crc >>> 8) ^ CRC_TABLE[(crc ^ b) & 0xff]
  return (crc ^ 0xffffffff) >>> 0
}

function concat(arrays: Uint8Array[]): Uint8Array {
  const total = arrays.reduce((s, a) => s + a.length, 0)
  const out = new Uint8Array(total)
  let offset = 0
  for (const a of arrays) {
    out.set(a, offset)
    offset += a.length
  }
  return out
}

function pngChunk(type: string, data: Uint8Array): Uint8Array {
  const typeBytes = new TextEncoder().encode(type)
  const lenBytes = new Uint8Array(4)
  new DataView(lenBytes.buffer).setUint32(0, data.length)

  const crcInput = concat([typeBytes, data])
  const crcBytes = new Uint8Array(4)
  new DataView(crcBytes.buffer).setUint32(0, crc32(crcInput))

  return concat([lenBytes, typeBytes, data, crcBytes])
}

function generatePNG(
  width: number,
  height: number,
  r: number,
  g: number,
  b: number,
): Uint8Array {
  // Each row: 1 filter byte (0 = None) + width * 3 RGB bytes
  const rowSize = 1 + width * 3
  const raw = new Uint8Array(height * rowSize)
  for (let y = 0; y < height; y++) {
    const base = y * rowSize
    for (let x = 0; x < width; x++) {
      raw[base + 1 + x * 3] = r
      raw[base + 1 + x * 3 + 1] = g
      raw[base + 1 + x * 3 + 2] = b
    }
  }

  const ihdr = new Uint8Array(13)
  const dv = new DataView(ihdr.buffer)
  dv.setUint32(0, width)
  dv.setUint32(4, height)
  dv.setUint8(8, 8) // bit depth
  dv.setUint8(9, 2) // color type: RGB truecolor

  return concat([
    new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10]), // PNG signature
    pngChunk("IHDR", ihdr),
    pngChunk("IDAT", new Uint8Array(deflateSync(raw))),
    pngChunk("IEND", new Uint8Array(0)),
  ])
}

const png = generatePNG(WIDTH, HEIGHT, COLOR.r, COLOR.g, COLOR.b)
const outPath = join(import.meta.dir, `${WIDTH}x${HEIGHT}.png`)
await Bun.write(outPath, png)
console.log(`Generated: ${outPath}`)
