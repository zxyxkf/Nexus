function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value))
}

function clampByte(value) {
  return Math.round(clamp(Number(value) || 0, 0, 255))
}

function normalizeColor(color) {
  if (Array.isArray(color)) {
    return { r: clampByte(color[0]), g: clampByte(color[1]), b: clampByte(color[2]) }
  }
  if (color && typeof color === 'object') {
    return { r: clampByte(color.r), g: clampByte(color.g), b: clampByte(color.b) }
  }
  const value = String(color || '').trim().replace(/^#/, '')
  const normalized = value.length === 3
    ? value.split('').map(character => character + character).join('')
    : value
  if (!/^[0-9a-f]{6}$/i.test(normalized)) throw new TypeError('需要有效的颜色值')
  return {
    r: parseInt(normalized.slice(0, 2), 16),
    g: parseInt(normalized.slice(2, 4), 16),
    b: parseInt(normalized.slice(4, 6), 16)
  }
}

function validateImageData(imageData) {
  if (!imageData?.data || !imageData.width || !imageData.height) {
    throw new TypeError('需要有效的 ImageData')
  }
}

function colorDistance(red, green, blue, color) {
  return Math.sqrt(
    ((red - color.r) ** 2) +
    ((green - color.g) ** 2) +
    ((blue - color.b) ** 2)
  )
}

function smoothstep(start, end, value) {
  if (end <= start) return value >= end ? 1 : 0
  const ratio = clamp((value - start) / (end - start), 0, 1)
  return ratio * ratio * (3 - (2 * ratio))
}

function imageDataFrom(data, width, height) {
  return new ImageData(data, width, height)
}

export function estimateEdgeBackground(imageData) {
  validateImageData(imageData)
  const { data, width, height } = imageData
  const buckets = new Map()

  const collect = index => {
    const offset = index * 4
    if (data[offset + 3] < 16) return
    const key = [data[offset], data[offset + 1], data[offset + 2]]
      .map(channel => Math.round(channel / 16))
      .join(':')
    const bucket = buckets.get(key) || { count: 0, r: 0, g: 0, b: 0 }
    bucket.count += 1
    bucket.r += data[offset]
    bucket.g += data[offset + 1]
    bucket.b += data[offset + 2]
    buckets.set(key, bucket)
  }

  for (let x = 0; x < width; x += 1) {
    collect(x)
    if (height > 1) collect(((height - 1) * width) + x)
  }
  for (let y = 1; y < height - 1; y += 1) {
    collect(y * width)
    if (width > 1) collect((y * width) + width - 1)
  }

  const dominant = [...buckets.values()].sort((left, right) => right.count - left.count)[0]
  if (!dominant) return { r: 255, g: 255, b: 255 }
  return {
    r: Math.round(dominant.r / dominant.count),
    g: Math.round(dominant.g / dominant.count),
    b: Math.round(dominant.b / dominant.count)
  }
}

export function removeBackground(imageData, options = {}) {
  validateImageData(imageData)
  const background = normalizeColor(options.background || estimateEdgeBackground(imageData))
  const tolerance = clamp(Number(options.tolerance) || 0, 0, 255)
  const edgeCleanup = clamp(Number(options.edgeCleanup) || 0, 0, 100)
  const softRange = Math.max(2, 8 + (edgeCleanup * 0.6))
  const transparentDistance = tolerance * 0.65
  const opaqueDistance = tolerance + softRange
  const cleanupStrength = edgeCleanup / 100
  const output = new Uint8ClampedArray(imageData.data)

  for (let offset = 0; offset < output.length; offset += 4) {
    const originalAlpha = output[offset + 3]
    if (!originalAlpha) continue
    const distance = colorDistance(output[offset], output[offset + 1], output[offset + 2], background)
    const foregroundRatio = smoothstep(transparentDistance, opaqueDistance, distance)
    if (foregroundRatio <= 0.015) {
      output[offset + 3] = 0
      continue
    }

    if (foregroundRatio < 0.999 && cleanupStrength > 0) {
      const stableRatio = Math.max(0.08, foregroundRatio)
      const channels = ['r', 'g', 'b']
      for (let channel = 0; channel < 3; channel += 1) {
        const original = output[offset + channel]
        const cleaned = clamp(
          (original - ((1 - stableRatio) * background[channels[channel]])) / stableRatio,
          0,
          255
        )
        output[offset + channel] = Math.round(original + ((cleaned - original) * cleanupStrength))
      }
    }
    output[offset + 3] = Math.round(originalAlpha * foregroundRatio)
  }

  return imageDataFrom(output, imageData.width, imageData.height)
}

export function recolorSolid(imageData, targetColor) {
  validateImageData(imageData)
  const target = normalizeColor(targetColor)
  const output = new Uint8ClampedArray(imageData.data)
  for (let offset = 0; offset < output.length; offset += 4) {
    if (!output[offset + 3]) continue
    output[offset] = target.r
    output[offset + 1] = target.g
    output[offset + 2] = target.b
  }
  return imageDataFrom(output, imageData.width, imageData.height)
}

export function recolorMatching(imageData, sourceColor, targetColor, tolerance = 36) {
  validateImageData(imageData)
  const source = normalizeColor(sourceColor)
  const target = normalizeColor(targetColor)
  const safeTolerance = clamp(Number(tolerance) || 0, 0, 255)
  const fadeStart = safeTolerance * 0.55
  const fadeEnd = Math.max(fadeStart + 1, safeTolerance)
  const output = new Uint8ClampedArray(imageData.data)

  for (let offset = 0; offset < output.length; offset += 4) {
    if (!output[offset + 3]) continue
    const distance = colorDistance(output[offset], output[offset + 1], output[offset + 2], source)
    const strength = 1 - smoothstep(fadeStart, fadeEnd, distance)
    if (strength <= 0) continue
    output[offset] = Math.round(output[offset] + ((target.r - output[offset]) * strength))
    output[offset + 1] = Math.round(output[offset + 1] + ((target.g - output[offset + 1]) * strength))
    output[offset + 2] = Math.round(output[offset + 2] + ((target.b - output[offset + 2]) * strength))
  }
  return imageDataFrom(output, imageData.width, imageData.height)
}

export function samplePixel(imageData, x, y) {
  validateImageData(imageData)
  const safeX = clamp(Math.floor(Number(x) || 0), 0, imageData.width - 1)
  const safeY = clamp(Math.floor(Number(y) || 0), 0, imageData.height - 1)
  const offset = ((safeY * imageData.width) + safeX) * 4
  return {
    r: imageData.data[offset],
    g: imageData.data[offset + 1],
    b: imageData.data[offset + 2],
    a: imageData.data[offset + 3]
  }
}

export function removeConnectedBackground(imageData, tolerance = 42) {
  return removeBackground(imageData, { tolerance, edgeCleanup: 35 })
}
