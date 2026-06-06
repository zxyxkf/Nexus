/**
 * 应用层互斥锁 — 弥补 SQLite 下 FOR UPDATE 被移除的并发缺口
 * 基于内存 Map 的 FIFO 队列锁，保证同一 key 的操作串行执行
 */
const queues = new Map();

/**
 * 对同一 key 的并发调用串行化
 * @param {string} key 锁标识（如 "accept:123"）
 * @param {() => Promise<T>} fn 受保护的操作
 * @returns {Promise<T>}
 */
async function withLock(key, fn) {
  if (!queues.has(key)) queues.set(key, []);
  const queue = queues.get(key);

  // 等待之前所有持有者完成
  const prev = queue.length > 0 ? queue[queue.length - 1] : Promise.resolve();

  let resolve;
  const curr = new Promise(r => { resolve = r; });
  queue.push(curr);

  await prev;
  try {
    return await fn();
  } finally {
    const idx = queue.indexOf(curr);
    if (idx >= 0) queue.splice(idx, 1);
    if (queue.length === 0) queues.delete(key);
    resolve();
  }
}

module.exports = { withLock };
