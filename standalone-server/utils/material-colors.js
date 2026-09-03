const path = require('path');

const COLOR_SUFFIX_PATTERN = /[色红橙黄绿青蓝紫黑白灰粉棕褐金银]$/;
const MARKERLESS_COLORS = new Set(['卡其', '咖啡', '杏']);

function normalizeColor(value) {
  return String(value || '').trim().replace(/\s+/g, ' ');
}

function inferColor(name) {
  const base = path.basename(String(name || ''), path.extname(String(name || ''))).trim();
  const match = base.match(/^([\u3400-\u9fff]{1,8})(?=[A-Za-z0-9\s_\-()[\].]|$)/);
  const candidate = normalizeColor(match?.[1] || '');
  if (!candidate) return '';
  return COLOR_SUFFIX_PATTERN.test(candidate) || MARKERLESS_COLORS.has(candidate)
    ? candidate
    : '';
}

function collectColors(images = []) {
  return [...new Set(images.map(image => normalizeColor(image.color)).filter(Boolean))];
}

module.exports = { normalizeColor, inferColor, collectColors };
