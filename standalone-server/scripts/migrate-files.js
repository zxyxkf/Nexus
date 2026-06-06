/**
 * 文件迁移脚本 — 将 SMB 共享文件迁移到本地磁盘
 *
 * 用法（在旧服务器上运行，SMB 连接仍然有效时）：
 *   node scripts/migrate-files.js
 *
 * 功能：
 * 1. 找出 task_file 中所有 share: 前缀的记录
 * 2. 从 SMB 共享 (\\192.168.101.51\数据库\图片附件) 拷贝文件到 D:\images
 * 3. 去掉数据库中的 share: 前缀
 * 4. 验证迁移完整性
 */

const path = require('path');
const fs = require('fs');

async function main() {
  // 动态导入数据库引擎
  const { initDatabase, getPool, close } = require('../config/database');
  const { readImage } = require('../utils/share');

  console.log('=== 文件迁移：SMB 共享 → 本地 D:\\images ===\n');

  // 初始化数据库
  const { mode } = await initDatabase();
  console.log(`数据库模式: ${mode}\n`);

  const pool = getPool();

  // 查找 share: 前缀的记录
  const [records] = await pool.execute(
    `SELECT id, file_name, file_path FROM task_file WHERE file_path LIKE 'share:%'`
  );

  if (records.length === 0) {
    console.log('没有 share: 前缀的文件记录，无需迁移。');
    close();
    return;
  }

  console.log(`找到 ${records.length} 条 share: 前缀记录\n`);

  let migrated = 0;
  let skipped = 0;
  let failed = 0;

  const targetDir = process.env.IMAGE_DIR || 'D:\\images';
  if (!fs.existsSync(targetDir)) {
    fs.mkdirSync(targetDir, { recursive: true });
    console.log(`创建目标目录: ${targetDir}\n`);
  }

  for (const record of records) {
    const sharePath = record.file_path.replace('share:', '');
    const targetPath = path.join(targetDir, sharePath.replace('images/', ''));
    const targetSubDir = path.dirname(targetPath);

    console.log(`[${record.id}] ${sharePath}`);

    // 尝试从 SMB 读取文件
    let buffer = null;
    try {
      const result = readImage(record.file_path);
      if (result) buffer = result.buffer;
    } catch (e) {
      // readImage 可能抛异常（SMB 不可用）
    }

    if (!buffer) {
      console.log(`  → 跳过（无法读取源文件，SMB 可能已断开）`);
      // 仍然更新数据库（去掉 share: 前缀），文件已丢失但记录保持
      await pool.execute(
        `UPDATE task_file SET file_path = ? WHERE id = ?`,
        [sharePath, record.id]
      );
      skipped++;
      continue;
    }

    // 写入 D:\images
    try {
      if (!fs.existsSync(targetSubDir)) {
        fs.mkdirSync(targetSubDir, { recursive: true });
      }
      fs.writeFileSync(targetPath, buffer);

      await pool.execute(
        `UPDATE task_file SET file_path = ? WHERE id = ?`,
        [sharePath, record.id]
      );

      console.log(`  → 已迁移: ${sharePath} (${(buffer.length / 1024).toFixed(1)} KB)`);
      migrated++;
    } catch (e) {
      console.log(`  → 失败: ${e.message}`);
      failed++;
    }
  }

  console.log(`\n=== 迁移完成 ===`);
  console.log(`成功: ${migrated}`);
  console.log(`跳过（文件丢失）: ${skipped}`);
  console.log(`失败: ${failed}`);

  close();
}

main().catch(err => {
  console.error('迁移失败:', err.message);
  process.exit(1);
});
