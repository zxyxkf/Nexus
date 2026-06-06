-- ===========================================================
-- D-Design 电商美工任务管理系统 - 数据库初始化脚本
-- MySQL 8.0+ 推荐
-- ===========================================================

-- 创建数据库
CREATE DATABASE IF NOT EXISTS `d_design_art` DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

USE `d_design_art`;

-- ===========================================================
-- 1. 用户表 sys_user
-- ===========================================================
DROP TABLE IF EXISTS `sys_user`;
CREATE TABLE `sys_user` (
  `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT COMMENT '主键ID',
  `username` VARCHAR(50) NOT NULL COMMENT '登录用户名',
  `password` VARCHAR(255) NOT NULL COMMENT 'BCrypt加密密码',
  `real_name` VARCHAR(50) DEFAULT NULL COMMENT '真实姓名',
  `role` ENUM('admin','operator','designer') NOT NULL DEFAULT 'designer' COMMENT '角色：admin超级管理员/operator运营/designer美工',
  `status` TINYINT NOT NULL DEFAULT 1 COMMENT '状态：1启用 0禁用',
  `email` VARCHAR(100) DEFAULT NULL COMMENT '邮箱',
  `phone` VARCHAR(20) DEFAULT NULL COMMENT '手机号',
  `remark` VARCHAR(500) DEFAULT NULL COMMENT '备注',
  `ext_json` JSON DEFAULT NULL COMMENT '扩展字段(JSON)',
  `last_login_time` DATETIME DEFAULT NULL COMMENT '最后登录时间',
  `create_time` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  `update_time` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
  PRIMARY KEY (`id`) USING BTREE,
  UNIQUE KEY `uk_username` (`username`) USING BTREE,
  KEY `idx_role` (`role`) USING BTREE,
  KEY `idx_status` (`status`) USING BTREE,
  KEY `idx_create_time` (`create_time`) USING BTREE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='用户表';

-- ===========================================================
-- 2. 任务表 task_info
-- ===========================================================
DROP TABLE IF EXISTS `task_info`;
CREATE TABLE `task_info` (
  `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT COMMENT '主键ID',
  `task_no` VARCHAR(32) NOT NULL COMMENT '任务编号(自动生成)',
  `title` VARCHAR(200) NOT NULL COMMENT '任务标题',
  `description` TEXT DEFAULT NULL COMMENT '任务描述/需求说明',
  `status` ENUM('wait','accepted','doing','finished','rejected') NOT NULL DEFAULT 'wait' COMMENT '任务状态：wait待接单/accepted已接单/doing作图中/finished已完成/rejected已驳回',
  `priority` TINYINT NOT NULL DEFAULT 2 COMMENT '优先级：1低 2中 3高 4紧急',
  `publisher_id` BIGINT UNSIGNED NOT NULL COMMENT '发布人ID(运营)',
  `designer_id` BIGINT UNSIGNED DEFAULT NULL COMMENT '接单人ID(美工)',
  `deadline` DATETIME DEFAULT NULL COMMENT '截止时间',
  `reject_reason` VARCHAR(500) DEFAULT NULL COMMENT '驳回原因',
  `finished_at` DATETIME DEFAULT NULL COMMENT '完成时间',
  `ext_json` JSON DEFAULT NULL COMMENT '扩展字段(JSON)',
  `create_time` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  `update_time` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
  PRIMARY KEY (`id`) USING BTREE,
  UNIQUE KEY `uk_task_no` (`task_no`) USING BTREE,
  KEY `idx_status` (`status`) USING BTREE,
  KEY `idx_publisher_id` (`publisher_id`) USING BTREE,
  KEY `idx_designer_id` (`designer_id`) USING BTREE,
  KEY `idx_priority` (`priority`) USING BTREE,
  KEY `idx_create_time` (`create_time`) USING BTREE,
  KEY `idx_status_create` (`status`, `create_time`) USING BTREE,
  CONSTRAINT `fk_task_publisher` FOREIGN KEY (`publisher_id`) REFERENCES `sys_user`(`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_task_designer` FOREIGN KEY (`designer_id`) REFERENCES `sys_user`(`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='任务表';

-- ===========================================================
-- 3. 任务文件表 task_file
-- ===========================================================
DROP TABLE IF EXISTS `task_file`;
CREATE TABLE `task_file` (
  `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT COMMENT '主键ID',
  `task_id` BIGINT UNSIGNED NOT NULL COMMENT '任务ID',
  `file_name` VARCHAR(255) NOT NULL COMMENT '原始文件名',
  `file_path` VARCHAR(500) NOT NULL COMMENT '存储路径(相对路径,不含磁盘根)',
  `file_size` BIGINT UNSIGNED DEFAULT 0 COMMENT '文件大小(字节)',
  `file_type` ENUM('image','attachment') NOT NULL DEFAULT 'image' COMMENT '文件类型：image图片/attachment附件',
  `mime_type` VARCHAR(100) DEFAULT NULL COMMENT 'MIME类型',
  `uploader_id` BIGINT UNSIGNED NOT NULL COMMENT '上传人ID',
  `ext_json` JSON DEFAULT NULL COMMENT '扩展字段(JSON)',
  `create_time` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  PRIMARY KEY (`id`) USING BTREE,
  KEY `idx_task_id` (`task_id`) USING BTREE,
  KEY `idx_file_type` (`file_type`) USING BTREE,
  KEY `idx_uploader_id` (`uploader_id`) USING BTREE,
  CONSTRAINT `fk_file_task` FOREIGN KEY (`task_id`) REFERENCES `task_info`(`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='任务文件表';

-- ===========================================================
-- 4. 操作日志表 sys_oper_log
-- ===========================================================
DROP TABLE IF EXISTS `sys_oper_log`;
CREATE TABLE `sys_oper_log` (
  `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT COMMENT '主键ID',
  `user_id` BIGINT UNSIGNED DEFAULT NULL COMMENT '操作用户ID',
  `username` VARCHAR(50) DEFAULT NULL COMMENT '操作用户名',
  `role` VARCHAR(20) DEFAULT NULL COMMENT '用户角色',
  `operation` VARCHAR(100) NOT NULL COMMENT '操作类型(如: login/create_task/accept/reject/upload/finish)',
  `module` VARCHAR(50) DEFAULT NULL COMMENT '操作模块',
  `method` VARCHAR(20) DEFAULT NULL COMMENT '请求方法 GET/POST/PUT/DELETE',
  `request_url` VARCHAR(500) DEFAULT NULL COMMENT '请求URL',
  `request_params` TEXT DEFAULT NULL COMMENT '请求参数',
  `result_code` INT DEFAULT 0 COMMENT '结果码 0成功 其他失败',
  `result_msg` VARCHAR(500) DEFAULT NULL COMMENT '结果消息',
  `ip_addr` VARCHAR(50) DEFAULT NULL COMMENT 'IP地址',
  `cost_time` BIGINT DEFAULT 0 COMMENT '耗时(毫秒)',
  `ext_json` JSON DEFAULT NULL COMMENT '扩展字段(JSON)',
  `create_time` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  PRIMARY KEY (`id`) USING BTREE,
  KEY `idx_user_id` (`user_id`) USING BTREE,
  KEY `idx_operation` (`operation`) USING BTREE,
  KEY `idx_module` (`module`) USING BTREE,
  KEY `idx_create_time` (`create_time`) USING BTREE,
  KEY `idx_user_oper` (`user_id`, `operation`) USING BTREE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='操作日志表';

-- ===========================================================
-- 5. 系统配置表 sys_config
-- ===========================================================
DROP TABLE IF EXISTS `sys_config`;
CREATE TABLE `sys_config` (
  `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT COMMENT '主键ID',
  `config_key` VARCHAR(100) NOT NULL COMMENT '配置键',
  `config_value` TEXT NOT NULL COMMENT '配置值',
  `config_group` VARCHAR(50) DEFAULT 'system' COMMENT '配置分组',
  `config_desc` VARCHAR(500) DEFAULT NULL COMMENT '配置描述',
  `editable` TINYINT NOT NULL DEFAULT 1 COMMENT '是否可编辑 1是 0否',
  `ext_json` JSON DEFAULT NULL COMMENT '扩展字段(JSON)',
  `create_time` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  `update_time` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
  PRIMARY KEY (`id`) USING BTREE,
  UNIQUE KEY `uk_config_key` (`config_key`) USING BTREE,
  KEY `idx_config_group` (`config_group`) USING BTREE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='系统配置表';

-- ===========================================================
-- 初始化数据
-- ===========================================================

-- 1. 初始化超级管理员账号 (密码: admin123)
-- BCrypt hash of 'admin123' => $2a$10$... (使用BCrypt)
INSERT INTO `sys_user` (`username`, `password`, `real_name`, `role`, `status`, `remark`) VALUES
('admin', '$2a$10$N9qo8uLOickgx2ZMRZoMyeIjZAgcfl7p92ldGxad68LJZdL17lhWy', '系统管理员', 'admin', 1, '超级管理员账号，请首次登录后修改密码');

-- 注：上面BCrypt密码是示例，需在应用首次启动时重新生成。
-- 实际使用中，应用启动脚本会读取此处的临时密码并重新hash写入。

-- 2. 初始化默认系统配置
INSERT INTO `sys_config` (`config_key`, `config_value`, `config_group`, `config_desc`, `editable`) VALUES
('site_name', 'D-Design 美工任务管理系统', 'system', '系统名称', 1),
('site_logo', '', 'system', '系统Logo路径', 1),
('upload_max_size', '10', 'upload', '上传文件最大大小(MB)', 1),
('upload_allowed_image', 'jpg,jpeg,png,gif,webp', 'upload', '允许的图片格式', 1),
('upload_allowed_attachment', 'zip,rar,psd,ai,pdf', 'upload', '允许的附件格式', 1),
('task_auto_cancel_hours', '72', 'task', '任务自动取消时间(小时)', 1),
('pagination_page_size', '15', 'system', '默认分页大小', 1);

-- 3. 插入操作日志索引优化用统计视图的辅助记录（无实际数据）

-- ===========================================================
-- 建议：在应用首次启动时，通过以下SQL更新admin密码为真正的BCrypt hash
-- UPDATE sys_user SET password = ? WHERE username = 'admin';
-- 其中 ? 为应用启动时通过 bcrypt.hashSync('admin123', 10) 生成的真实hash
-- ===========================================================

COMMIT;
