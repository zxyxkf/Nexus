const path = require('path');
const { getDragWatermarkOutputExtension } = require('./drag-watermark');

const WATERMARK_LABEL_PATTERN = /^(?:首次|\d+)\.\d+$/u;

function normalizeDragWatermarkRequest(item = {}) {
  const watermarkText = String(item.watermarkText || '').trim();
  const watermarkVariant = String(item.watermarkVariant || '').trim();
  const requested = Boolean(watermarkText || watermarkVariant);

  if (!requested) {
    return {
      requested: false,
      valid: true,
      watermarkText: '',
      watermarkVariant: '',
      outputExtension: ''
    };
  }

  const valid = WATERMARK_LABEL_PATTERN.test(watermarkText)
    && watermarkVariant === `wm-v1:${watermarkText}`;
  return {
    requested: true,
    valid,
    watermarkText,
    watermarkVariant,
    outputExtension: valid
      ? getDragWatermarkOutputExtension(path.extname(String(item.fileName || '')))
      : ''
  };
}

function getDragCacheVariantKeyPart(item = {}) {
  const watermark = normalizeDragWatermarkRequest(item);
  if (!watermark.requested) return 'plain';
  if (!watermark.valid) return 'invalid-watermark';
  return [
    watermark.watermarkVariant,
    watermark.watermarkText,
    watermark.outputExtension
  ].map(encodeURIComponent).join(':');
}

function replaceDragFileExtension(fileName, extension) {
  const current = String(fileName || '');
  const currentExtension = path.extname(current);
  return `${currentExtension ? current.slice(0, -currentExtension.length) : current}${extension}`;
}

module.exports = {
  getDragCacheVariantKeyPart,
  normalizeDragWatermarkRequest,
  replaceDragFileExtension
};
