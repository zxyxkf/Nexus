const sharp = require('sharp');

const PRESERVED_FORMATS = new Set([
  '.jpg',
  '.jpeg',
  '.png',
  '.webp',
  '.gif',
  '.tif',
  '.tiff',
  '.avif'
]);

class DragWatermarkError extends Error {
  constructor(message, code = 'DRAG_WATERMARK_INVALID_IMAGE', options = {}) {
    super(message, options);
    this.name = 'DragWatermarkError';
    this.code = code;
  }
}

function normalizeExtension(extension) {
  const raw = String(extension || '').trim().toLowerCase();
  if (!raw) return '.png';
  const normalized = raw.startsWith('.') ? raw : `.${raw}`;
  return PRESERVED_FORMATS.has(normalized) ? normalized : '.png';
}

function escapeXml(value) {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

function estimateTextUnits(text) {
  return Array.from(text).reduce((total, character) => (
    total + (character.codePointAt(0) > 0x7f ? 0.95 : 0.62)
  ), 0);
}

function calculateWatermarkLayout(width, pageHeight, text) {
  const shortEdge = Math.max(1, Math.min(width, pageHeight));
  const margin = Math.max(2, Math.min(32, Math.round(shortEdge * 0.035)));
  const maxBoxWidth = Math.max(1, width - margin * 2);
  const maxBoxHeight = Math.max(1, pageHeight - margin * 2);
  const textUnits = Math.max(1, estimateTextUnits(text));
  const preferredFontSize = Math.max(8, Math.min(64, Math.round(shortEdge * 0.12)));
  const preferredPaddingX = Math.max(4, Math.round(preferredFontSize * 0.55));
  const availableTextWidth = Math.max(1, maxBoxWidth - preferredPaddingX * 2);
  const fontSize = Math.max(6, Math.min(
    preferredFontSize,
    Math.floor(availableTextWidth / textUnits)
  ));
  const paddingX = Math.max(3, Math.round(fontSize * 0.55));
  const paddingY = Math.max(2, Math.round(fontSize * 0.28));
  const naturalTextWidth = Math.max(1, Math.ceil(textUnits * fontSize));
  const boxWidth = Math.min(maxBoxWidth, naturalTextWidth + paddingX * 2);
  const boxHeight = Math.min(maxBoxHeight, Math.max(
    fontSize + paddingY * 2,
    Math.ceil(fontSize * 1.35 + paddingY * 2)
  ));

  return {
    margin,
    fontSize,
    boxWidth,
    boxHeight,
    textWidth: Math.max(1, Math.min(naturalTextWidth, boxWidth - paddingX * 2)),
    radius: Math.max(2, Math.round(fontSize * 0.35))
  };
}

function createWatermarkSvg(width, pageHeight, pages, text) {
  const layout = calculateWatermarkLayout(width, pageHeight, text);
  const safeText = escapeXml(text);
  const totalHeight = pageHeight * pages;
  const boxX = Math.max(0, width - layout.margin - layout.boxWidth);
  const boxY = Math.max(0, pageHeight - layout.margin - layout.boxHeight);
  const textX = boxX + layout.boxWidth / 2;
  const textY = boxY + layout.boxHeight / 2;
  const frames = [];

  for (let frame = 0; frame < pages; frame += 1) {
    frames.push(`
      <g transform="translate(0 ${frame * pageHeight})">
        <rect x="${boxX}" y="${boxY}" width="${layout.boxWidth}" height="${layout.boxHeight}"
          rx="${layout.radius}" ry="${layout.radius}" fill="#000000" fill-opacity="0.62" />
        <text x="${textX}" y="${textY}" text-anchor="middle" dominant-baseline="central"
          textLength="${layout.textWidth}" lengthAdjust="spacingAndGlyphs"
          font-family="Arial, Microsoft YaHei, sans-serif" font-size="${layout.fontSize}"
          font-weight="700" fill="#ffffff">${safeText}</text>
      </g>`);
  }

  return Buffer.from(`
    <svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${totalHeight}"
      viewBox="0 0 ${width} ${totalHeight}">
      ${frames.join('')}
    </svg>
  `);
}

function animatedOptions(metadata) {
  if (Number(metadata.pages || 1) <= 1) return {};
  const options = { loop: Number.isInteger(metadata.loop) ? metadata.loop : 0 };
  if (Array.isArray(metadata.delay) && metadata.delay.length) {
    options.delay = metadata.delay.map(value => Math.max(0, Number(value) || 0));
  }
  return options;
}

function encode(pipeline, extension, metadata) {
  const animation = animatedOptions(metadata);
  switch (extension) {
    case '.jpg':
    case '.jpeg':
      return pipeline.jpeg({ quality: 94, mozjpeg: true });
    case '.webp':
      return pipeline.webp({ quality: 94, effort: 3, ...animation });
    case '.gif':
      return pipeline.gif({ effort: 3, reuse: true, ...animation });
    case '.tif':
    case '.tiff':
      return pipeline.tiff({ quality: 94, compression: 'lzw' });
    case '.avif':
      return pipeline.avif({ quality: 88, effort: 3 });
    case '.png':
    default:
      return pipeline.png({ compressionLevel: 6, adaptiveFiltering: true });
  }
}

function rawSharpInput(image) {
  return {
    input: Buffer.from(image.data.buffer, image.data.byteOffset, image.data.byteLength),
    options: {
      raw: {
        width: image.width,
        height: image.height,
        channels: 4
      },
      failOn: 'error'
    }
  };
}

async function decodeSpecialInput(inputBuffer, inputExtension) {
  const extension = String(inputExtension || '').trim().toLowerCase();
  if (extension === '.bmp') {
    const decodeBmp = require('decode-bmp');
    return rawSharpInput(decodeBmp(inputBuffer));
  }
  if (extension === '.ico') {
    const decodeIco = require('decode-ico');
    const images = decodeIco(inputBuffer);
    const image = images.sort((left, right) => (
      (right.width * right.height * right.bpp) - (left.width * left.height * left.bpp)
    ))[0];
    if (!image) throw new Error('ICO 文件中没有可用图像');
    if (image.type === 'png') {
      return { input: Buffer.from(image.data), options: { animated: true, failOn: 'error' } };
    }
    return rawSharpInput(image);
  }
  if (extension === '.heic' || extension === '.heif') {
    const convertHeic = require('heic-convert');
    const png = await convertHeic({ buffer: inputBuffer, format: 'PNG' });
    return { input: Buffer.from(png), options: { animated: true, failOn: 'error' } };
  }
  throw new Error('图片格式不受支持');
}

async function getSharpInput(inputBuffer, inputExtension) {
  const direct = { input: inputBuffer, options: { animated: true, failOn: 'error' } };
  try {
    await sharp(direct.input, direct.options).metadata();
    return direct;
  } catch (error) {
    return decodeSpecialInput(inputBuffer, inputExtension);
  }
}

async function applyDragWatermark(inputBuffer, watermarkText, inputExtension) {
  if (!Buffer.isBuffer(inputBuffer) || inputBuffer.length === 0) {
    throw new DragWatermarkError('无法生成拖出水印：图片损坏或格式不受支持');
  }

  const text = String(watermarkText || '').trim();
  if (!text) {
    throw new DragWatermarkError(
      '无法生成拖出水印：水印文字不能为空',
      'DRAG_WATERMARK_INVALID_TEXT'
    );
  }

  try {
    const source = await getSharpInput(inputBuffer, inputExtension);
    const metadata = await sharp(source.input, source.options).metadata();
    const pages = Math.max(1, Number(metadata.pages) || 1);
    const autoWidth = Number(metadata.autoOrient?.width) || Number(metadata.width);
    const autoTotalHeight = Number(metadata.autoOrient?.height) || Number(metadata.height);
    const pageHeight = Math.max(1, Math.round(autoTotalHeight / pages));

    if (!Number.isInteger(autoWidth) || autoWidth <= 0 || !Number.isInteger(pageHeight)) {
      throw new Error('图片尺寸无效');
    }

    const extension = normalizeExtension(inputExtension);
    const overlay = createWatermarkSvg(autoWidth, pageHeight, pages, text);
    const pipeline = sharp(source.input, source.options)
      .rotate()
      .composite([{ input: overlay, left: 0, top: 0, blend: 'over' }]);
    const buffer = await encode(pipeline, extension, metadata).toBuffer();

    return { buffer, extension };
  } catch (error) {
    if (error instanceof DragWatermarkError) throw error;
    throw new DragWatermarkError(
      `无法生成拖出水印：图片损坏或格式不受支持（${error.message}）`,
      'DRAG_WATERMARK_INVALID_IMAGE',
      { cause: error }
    );
  }
}

module.exports = {
  applyDragWatermark,
  DragWatermarkError,
  getDragWatermarkOutputExtension: normalizeExtension
};
