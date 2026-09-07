const path = require('path');

const COLOR_SUFFIX_PATTERN = /[色红橙黄绿青蓝紫黑白灰粉棕褐金银]$/;
const MARKERLESS_COLORS = new Set(['卡其', '咖啡', '杏']);

// These are useful for names without a color suffix (for example "卡其A").
// Longer names are checked first.
const COLOR_PREFIXES = [
  '白色拼秋香绿', '爱马仕橙', '黑白', '军绿色', '橄榄绿', '墨绿色', '深绿色', '浅绿色',
  '樱花粉', '玫红色', '宝石蓝', '藏蓝色', '藏蓝', '海军蓝', '冰川蓝', '深蓝色', '浅蓝色',
  '酒红', '秋香绿',
  '深灰色', '浅灰色', '深紫色', '浅紫色', '深棕色', '浅棕色', '卡其色',
  '红色', '橙色', '黄色', '绿色', '青色', '蓝色', '紫色', '黑色', '白色',
  '灰色', '粉色', '棕色', '褐色', '金色', '银色', '卡其', '咖啡', '杏'
].sort((left, right) => right.length - left.length);

const GENERIC_IMAGE_PREFIXES = ['图片', '照片', '商品图', '主图', '详情图', '效果图', '原图', '素材图', '示意图'];

function normalizeColor(value) {
  return String(value || '').trim().replace(/\s+/g, ' ');
}

function inferColor(name) {
  const base = path.basename(String(name || ''), path.extname(String(name || ''))).trim();
  if (!base) return '';

  // Preserve compound names such as "白色拼秋香绿" when the complete
  // leading Chinese segment is a color. Generic image prefixes are excluded
  // so names such as "图片蓝色A" do not become a color accidentally.
  const leadingChinese = base.match(/^[\u3400-\u9fff]{1,16}(?=[A-Za-z0-9\s_\-()[\].]|$)/)?.[0] || '';
  if (leadingChinese && !GENERIC_IMAGE_PREFIXES.some(prefix => leadingChinese.startsWith(prefix))) {
    const candidate = normalizeColor(leadingChinese);
    if (COLOR_SUFFIX_PATTERN.test(candidate) || MARKERLESS_COLORS.has(candidate)) return candidate;
  }

  const knownPrefix = COLOR_PREFIXES.find(prefix => base.startsWith(prefix));
  if (knownPrefix) return knownPrefix;

  // Fall back to the first leading color word so descriptive names such as
  // "白色薄款两件套" and "奶茶色A" remain filterable.
  const colorWord = base.match(/^[\u3400-\u9fff]{1,8}(?:色|红|橙|黄|绿|青|蓝|紫|黑|白|灰|粉|棕|褐|金|银)/)?.[0] || '';
  return colorWord && !GENERIC_IMAGE_PREFIXES.some(prefix => colorWord.startsWith(prefix))
    ? colorWord
    : '';
}

function collectColors(images = []) {
  return [...new Set(images.map(image => normalizeColor(image.color)).filter(Boolean))];
}

module.exports = { normalizeColor, inferColor, collectColors };
