const path = require('path');

function normalizeColor(value) {
  return String(value || '').trim().replace(/\s+/g, ' ');
}

function inferColor(name) {
  const base = path.basename(String(name || ''), path.extname(String(name || ''))).trim();
  const match = base.match(/^([\u3400-\u9fff]{1,8})(?=[A-Za-z0-9\s_\-()[\].]|$)/);
  return normalizeColor(match?.[1] || '');
}

function collectColors(images = []) {
  return [...new Set(images.map(image => normalizeColor(image.color)).filter(Boolean))];
}

module.exports = { normalizeColor, inferColor, collectColors };
