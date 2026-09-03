function clampTolerance(value) {
  const numeric = Number(value)
  if (!Number.isFinite(numeric)) return 42
  return Math.min(255, Math.max(0, Math.round(numeric)))
}

function withinTolerance(data, offset, seedColor, tolerance) {
  const red = seedColor >>> 16
  const green = (seedColor >>> 8) & 0xff
  const blue = seedColor & 0xff
  return Math.max(
    Math.abs(data[offset] - red),
    Math.abs(data[offset + 1] - green),
    Math.abs(data[offset + 2] - blue)
  ) <= tolerance
}

/**
 * Removes only background-colored pixels connected to one of the image edges.
 * The caller's ImageData is never modified.
 */
export function removeConnectedBackground(imageData, tolerance = 42) {
  if (!imageData?.data || !imageData.width || !imageData.height) {
    throw new TypeError('需要有效的 ImageData')
  }

  const width = imageData.width
  const height = imageData.height
  const pixelCount = width * height
  const output = new Uint8ClampedArray(imageData.data)
  const visited = new Uint8Array(pixelCount)
  const queue = new Int32Array(pixelCount)
  const seedColors = new Uint32Array(pixelCount)
  const safeTolerance = clampTolerance(tolerance)
  let head = 0
  let tail = 0

  const enqueueSeed = index => {
    if (visited[index]) return
    const offset = index * 4
    visited[index] = 1
    queue[tail] = index
    seedColors[tail] = (output[offset] << 16) | (output[offset + 1] << 8) | output[offset + 2]
    tail += 1
  }

  for (let x = 0; x < width; x += 1) {
    enqueueSeed(x)
    enqueueSeed((height - 1) * width + x)
  }
  for (let y = 1; y < height - 1; y += 1) {
    enqueueSeed(y * width)
    enqueueSeed(y * width + width - 1)
  }

  const visitNeighbor = (index, seedColor) => {
    if (visited[index]) return
    if (!withinTolerance(output, index * 4, seedColor, safeTolerance)) return
    visited[index] = 1
    queue[tail] = index
    seedColors[tail] = seedColor
    tail += 1
  }

  while (head < tail) {
    const index = queue[head]
    const seedColor = seedColors[head]
    head += 1
    output[index * 4 + 3] = 0

    const x = index % width
    const y = Math.floor(index / width)
    if (x > 0) visitNeighbor(index - 1, seedColor)
    if (x + 1 < width) visitNeighbor(index + 1, seedColor)
    if (y > 0) visitNeighbor(index - width, seedColor)
    if (y + 1 < height) visitNeighbor(index + width, seedColor)
  }

  return new ImageData(output, width, height)
}
