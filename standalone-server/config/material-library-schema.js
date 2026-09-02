/** Material library schema shared by SQLite and MySQL. */
const sqlite = [
  `CREATE TABLE IF NOT EXISTS material_product (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL UNIQUE,
    created_by INTEGER,
    create_time TEXT DEFAULT (datetime('now', 'localtime')),
    update_time TEXT DEFAULT (datetime('now', 'localtime'))
  )`,
  `CREATE TABLE IF NOT EXISTS material_style (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    product_id INTEGER NOT NULL,
    name TEXT NOT NULL,
    created_by INTEGER,
    create_time TEXT DEFAULT (datetime('now', 'localtime')),
    update_time TEXT DEFAULT (datetime('now', 'localtime')),
    UNIQUE(product_id, name),
    FOREIGN KEY(product_id) REFERENCES material_product(id) ON DELETE CASCADE
  )`,
  `CREATE TABLE IF NOT EXISTS material_image (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    style_id INTEGER NOT NULL,
    original_name TEXT NOT NULL DEFAULT '',
    display_name TEXT NOT NULL DEFAULT '',
    color TEXT DEFAULT '',
    color_source TEXT NOT NULL DEFAULT 'auto',
    sort_order INTEGER NOT NULL DEFAULT 0,
    file_path TEXT NOT NULL DEFAULT '',
    file_size INTEGER NOT NULL DEFAULT 0,
    mime_type TEXT NOT NULL DEFAULT '',
    created_by INTEGER,
    create_time TEXT DEFAULT (datetime('now', 'localtime')),
    update_time TEXT DEFAULT (datetime('now', 'localtime')),
    FOREIGN KEY(style_id) REFERENCES material_style(id) ON DELETE CASCADE
  )`,
  `CREATE INDEX IF NOT EXISTS idx_material_style_product ON material_style(product_id)`,
  `CREATE INDEX IF NOT EXISTS idx_material_image_style_order ON material_image(style_id, sort_order, id)`,
  `CREATE INDEX IF NOT EXISTS idx_material_image_style_color ON material_image(style_id, color)`
]

const mysql = [
  `CREATE TABLE IF NOT EXISTS material_product (
    id INT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(200) NOT NULL UNIQUE,
    created_by INT,
    create_time DATETIME DEFAULT CURRENT_TIMESTAMP,
    update_time DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`,
  `CREATE TABLE IF NOT EXISTS material_style (
    id INT AUTO_INCREMENT PRIMARY KEY,
    product_id INT NOT NULL,
    name VARCHAR(200) NOT NULL,
    created_by INT,
    create_time DATETIME DEFAULT CURRENT_TIMESTAMP,
    update_time DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    UNIQUE KEY uq_material_style_product_name(product_id, name),
    KEY idx_material_style_product(product_id),
    CONSTRAINT fk_material_style_product FOREIGN KEY(product_id) REFERENCES material_product(id) ON DELETE CASCADE
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`,
  `CREATE TABLE IF NOT EXISTS material_image (
    id INT AUTO_INCREMENT PRIMARY KEY,
    style_id INT NOT NULL,
    original_name VARCHAR(500) NOT NULL DEFAULT '',
    display_name VARCHAR(500) NOT NULL DEFAULT '',
    color VARCHAR(100) DEFAULT '',
    color_source VARCHAR(20) NOT NULL DEFAULT 'auto',
    sort_order INT NOT NULL DEFAULT 0,
    file_path VARCHAR(1000) NOT NULL DEFAULT '',
    file_size INT NOT NULL DEFAULT 0,
    mime_type VARCHAR(100) NOT NULL DEFAULT '',
    created_by INT,
    create_time DATETIME DEFAULT CURRENT_TIMESTAMP,
    update_time DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    KEY idx_material_image_style_order(style_id, sort_order, id),
    KEY idx_material_image_style_color(style_id, color),
    CONSTRAINT fk_material_image_style FOREIGN KEY(style_id) REFERENCES material_style(id) ON DELETE CASCADE
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`
]

function getMaterialLibrarySchema(mode = 'sqlite') {
  return mode === 'mysql' ? mysql : sqlite
}

module.exports = { getMaterialLibrarySchema }
