const fs = require('fs');
const sharp = require('sharp');

const MAX_CACHE_ENTRIES = 300;
const MAX_CONCURRENT_GENERATIONS = 3;
const thumbnailCache = new Map();
const pendingThumbnails = new Map();
const generationQueue = [];
let activeGenerations = 0;

function runNextGeneration() {
  while (activeGenerations < MAX_CONCURRENT_GENERATIONS && generationQueue.length) {
    const job = generationQueue.shift();
    activeGenerations += 1;
    Promise.resolve()
      .then(job.generate)
      .then(job.resolve, job.reject)
      .finally(() => {
        activeGenerations -= 1;
        runNextGeneration();
      });
  }
}

function queueGeneration(generate) {
  return new Promise((resolve, reject) => {
    generationQueue.push({ generate, resolve, reject });
    runNextGeneration();
  });
}

function rememberThumbnail(key, buffer) {
  if (thumbnailCache.has(key)) thumbnailCache.delete(key);
  thumbnailCache.set(key, buffer);
  while (thumbnailCache.size > MAX_CACHE_ENTRIES) {
    thumbnailCache.delete(thumbnailCache.keys().next().value);
  }
}

async function getImageThumbnail(absolutePath) {
  const stat = await fs.promises.stat(absolutePath);
  const key = `${absolutePath}:${stat.size}:${stat.mtimeMs}`;
  const cached = thumbnailCache.get(key);
  if (cached) {
    thumbnailCache.delete(key);
    thumbnailCache.set(key, cached);
    return cached;
  }

  const pending = pendingThumbnails.get(key);
  if (pending) return pending;

  const generation = queueGeneration(() => sharp(absolutePath, { failOn: 'none' })
    .rotate()
    .resize(160, 160, { fit: 'inside', withoutEnlargement: true })
    .webp({ quality: 76, effort: 2 })
    .toBuffer())
    .then(buffer => {
      rememberThumbnail(key, buffer);
      return buffer;
    })
    .finally(() => pendingThumbnails.delete(key));

  pendingThumbnails.set(key, generation);
  return generation;
}

module.exports = { getImageThumbnail };
