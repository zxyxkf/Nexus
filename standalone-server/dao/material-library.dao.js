const { execute } = require('../config/database');

function run(executor, sql, params = []) {
  return executor?.execute ? executor.execute(sql, params) : execute(sql, params);
}

function placeholders(values) {
  return values.map(() => '?').join(',');
}

async function listProducts(keyword = '') {
  const params = [];
  let where = '';
  if (keyword) {
    where = 'WHERE p.name LIKE ?';
    params.push(`%${keyword}%`);
  }
  const [rows] = await execute(
    `SELECT p.*, COUNT(s.id) AS style_count,
            (SELECT i.id FROM material_image i
             INNER JOIN material_style si ON si.id = i.style_id
             WHERE si.product_id = p.id ORDER BY i.sort_order, i.id LIMIT 1) AS preview_path
     FROM material_product p
     LEFT JOIN material_style s ON s.product_id = p.id
     ${where}
     GROUP BY p.id
     ORDER BY p.name, p.id`,
    params
  );
  return rows;
}

async function getProduct(id, executor = null) {
  const [rows] = await run(executor, 'SELECT * FROM material_product WHERE id = ?', [id]);
  return rows[0] || null;
}

async function createProduct(name, userId) {
  const [result] = await execute(
    'INSERT INTO material_product (name, created_by) VALUES (?, ?)',
    [name, userId]
  );
  return getProduct(result.insertId);
}

async function renameProduct(id, name, executor = null) {
  await run(executor, 'UPDATE material_product SET name = ?, update_time = CURRENT_TIMESTAMP WHERE id = ?', [name, id]);
  return getProduct(id, executor);
}

async function deleteProduct(id, executor = null) {
  return run(executor, 'DELETE FROM material_product WHERE id = ?', [id]);
}

async function listStyles(productId, keyword = '', executor = null) {
  const params = [productId];
  let where = 'WHERE s.product_id = ?';
  if (keyword) {
    where += ' AND s.name LIKE ?';
    params.push(`%${keyword}%`);
  }
  const [rows] = await run(executor,
    `SELECT s.*, p.name AS product_name, COUNT(i.id) AS image_count,
            (SELECT mi.id FROM material_image mi
             WHERE mi.style_id = s.id ORDER BY mi.sort_order, mi.id LIMIT 1) AS preview_path
     FROM material_style s
     INNER JOIN material_product p ON p.id = s.product_id
     LEFT JOIN material_image i ON i.style_id = s.id
     ${where}
     GROUP BY s.id
     ORDER BY s.name, s.id`,
    params
  );
  return rows;
}

async function getStyle(id, executor = null) {
  const [rows] = await run(executor,
    `SELECT s.*, p.name AS product_name FROM material_style s
     INNER JOIN material_product p ON p.id = s.product_id WHERE s.id = ?`, [id]
  );
  return rows[0] || null;
}

async function createStyle(productId, name, userId) {
  const [result] = await execute(
    'INSERT INTO material_style (product_id, name, created_by) VALUES (?, ?, ?)',
    [productId, name, userId]
  );
  return getStyle(result.insertId);
}

async function renameStyle(id, name, executor = null) {
  await run(executor, 'UPDATE material_style SET name = ?, update_time = CURRENT_TIMESTAMP WHERE id = ?', [name, id]);
  return getStyle(id, executor);
}

async function deleteStyle(id, executor = null) {
  return run(executor, 'DELETE FROM material_style WHERE id = ?', [id]);
}

async function listImages(styleId, color = '', executor = null) {
  const params = [styleId];
  let where = 'WHERE style_id = ?';
  if (color) {
    where += ' AND color = ?';
    params.push(color);
  }
  const [rows] = await run(executor,
    `SELECT * FROM material_image ${where} ORDER BY sort_order, id`, params
  );
  return rows;
}

async function getImage(id, executor = null) {
  const [rows] = await run(executor, 'SELECT * FROM material_image WHERE id = ?', [id]);
  return rows[0] || null;
}

async function getImagesByIds(ids, executor = null) {
  if (!ids.length) return [];
  const [rows] = await run(executor,
    `SELECT * FROM material_image WHERE id IN (${placeholders(ids)}) ORDER BY sort_order, id`, ids
  );
  return rows;
}

async function listImagesByProduct(productId, executor = null) {
  const [rows] = await run(executor,
    `SELECT i.* FROM material_image i
     INNER JOIN material_style s ON s.id = i.style_id
     WHERE s.product_id = ? ORDER BY s.id, i.sort_order, i.id`,
    [productId]
  );
  return rows;
}

async function getNextSortOrder(styleId, executor = null) {
  const [rows] = await run(executor, 'SELECT COALESCE(MAX(sort_order), -1) AS max_order FROM material_image WHERE style_id = ?', [styleId]);
  return Number(rows[0]?.max_order ?? -1) + 1;
}

async function createImage(data, executor = null) {
  const [result] = await run(executor,
    `INSERT INTO material_image
      (style_id, original_name, display_name, color, color_source, sort_order, file_path, file_size, mime_type, created_by)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [data.styleId, data.originalName, data.displayName, data.color || '', data.colorSource || 'auto',
      data.sortOrder, data.filePath, data.fileSize || 0, data.mimeType || '', data.createdBy]
  );
  return getImage(result.insertId, executor);
}

async function renameImage(id, displayName, color, colorSource) {
  await execute(
    'UPDATE material_image SET display_name = ?, color = ?, color_source = ?, update_time = CURRENT_TIMESTAMP WHERE id = ?',
    [displayName, color || '', colorSource || 'auto', id]
  );
  return getImage(id);
}

async function updateImageColor(id, color) {
  await execute(
    'UPDATE material_image SET color = ?, color_source = ?, update_time = CURRENT_TIMESTAMP WHERE id = ?',
    [color || '', 'manual', id]
  );
  return getImage(id);
}

async function deleteImage(id, executor = null) {
  return run(executor, 'DELETE FROM material_image WHERE id = ?', [id]);
}

async function setImageOrder(id, sortOrder, executor = null) {
  return run(executor, 'UPDATE material_image SET sort_order = ?, update_time = CURRENT_TIMESTAMP WHERE id = ?', [sortOrder, id]);
}

async function updateImagePath(id, filePath, executor = null) {
  return run(executor, 'UPDATE material_image SET file_path = ?, update_time = CURRENT_TIMESTAMP WHERE id = ?', [filePath, id]);
}

async function search(keyword, { stylesOnly = false, limit = null } = {}) {
  const term = `%${keyword}%`;
  let products = [];
  if (!stylesOnly) {
    [products] = await execute(
      'SELECT id, name FROM material_product WHERE name LIKE ? ORDER BY name, id', [term]
    );
  }

  const boundedLimit = Number.isInteger(limit) && limit > 0 ? limit : null;
  const params = [term];
  let orderBy = 'ORDER BY p.name, s.name, s.id';
  let limitSql = '';
  if (boundedLimit) {
    orderBy = `ORDER BY CASE
      WHEN s.name = ? THEN 0
      WHEN s.name LIKE ? THEN 1
      ELSE 2
    END, p.name, s.name, s.id`;
    params.push(keyword, `${keyword}%`);
    limitSql = ` LIMIT ${boundedLimit + 1}`;
  }

  const [styles] = await execute(
    `SELECT s.id, s.product_id, s.name, p.name AS product_name
     FROM material_style s INNER JOIN material_product p ON p.id = s.product_id
     WHERE s.name LIKE ? ${orderBy}${limitSql}`,
    params
  );
  const hasMore = Boolean(boundedLimit && styles.length > boundedLimit);
  return {
    products,
    styles: boundedLimit ? styles.slice(0, boundedLimit) : styles,
    hasMore
  };
}

module.exports = {
  listProducts, getProduct, createProduct, renameProduct, deleteProduct,
  listStyles, getStyle, createStyle, renameStyle, deleteStyle,
  listImages, getImage, getImagesByIds, listImagesByProduct, getNextSortOrder, createImage,
  renameImage, updateImageColor, deleteImage, setImageOrder, updateImagePath, search
};
