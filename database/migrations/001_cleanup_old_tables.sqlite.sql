-- 001: 清理废弃表（SQLite 版）
-- 废弃表：sys_task, task_files, sys_task_file
-- 替代表：task_info（任务）, task_file（文件）
-- 执行前请确认旧表中无残留数据

DROP TABLE IF EXISTS sys_task;
DROP TABLE IF EXISTS task_files;
DROP TABLE IF EXISTS sys_task_file;
