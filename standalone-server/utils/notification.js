/**
 * 通知工具 - 发送站内通知 + 桌面通知
 */

const { execute } = require('../config/database');

function roleLabel(role) {
  const map = {
    designer: '美工',
    basic_designer: '基础美工',
    operator_assistant: '运营助理'
  };
  return map[role] || '用户';
}

/**
 * 发送站内通知
 * @param {Object} opts
 * @param {number} opts.userId - 接收者用户ID
 * @param {string} opts.type - 通知类型: task_accept/task_submit/task_review/task_reject/system
 * @param {string} opts.title - 通知标题
 * @param {string} opts.content - 通知内容
 * @param {number} opts.taskId - 关联任务ID
 */
function notificationPriority(type) {
  if (['task_urge', 'task_reject', 'task_transfer', 'score_review', 'score_reject'].includes(type)) return 3;
  if (['task_submit', 'task_review', 'task_assigned'].includes(type)) return 2;
  return 1;
}

async function sendNotification({ userId, type, title, content, taskId, taskTitle, taskGroup, publisherId, designerId, priority }) {
  try {
    await execute(
      `INSERT INTO sys_notification (user_id, type, title, content, task_id)
       VALUES (?, ?, ?, ?, ?)`,
      [userId, type || 'system', title, content, taskId || null]
    );

    // WebSocket 实时推送桌面通知
    if (userId && global.io) {
      const wsTypeMap = {
        task_urge: 'urge',
        task_accept: 'task_accepted',
        task_submit: 'task_submitted',
        task_reject: 'task_rejected',
        task_review: 'task_accepted',
        task_transfer: 'task_transferred',
        task_assigned: 'task_assigned'
      };
      global.io.to(`user:${userId}`).emit('notification:new', {
        type: wsTypeMap[type] || 'info',
        eventType: type || 'system',
        priority: priority || notificationPriority(type),
        taskId: taskId || undefined,
        taskTitle: taskTitle || title,
        task_group: taskGroup || undefined,
        publisher_id: publisherId || undefined,
        designer_id: designerId || undefined,
        title,
        content
      });
    }

    return true;
  } catch (err) {
    console.error('[Notify] 发送通知失败:', err);
    return false;
  }
}

/**
 * 任务事件通知 - 统一入口
 */
async function notifyTaskEvent(eventType, task, actor) {
  const { publisher_id, designer_id, task_no, title } = task;

  const eventConfig = {
    task_accept: {
      userId: publisher_id,
      type: 'task_accept',
      title: '任务已接单',
      taskTitle: title,
      content: `${roleLabel(actor?.role)} ${actor?.realName || ''} 已接取您的任务「${title}」`,
      taskId: task.id,
      taskGroup: task.task_group,
      publisherId: publisher_id,
      designerId: designer_id
    },
    task_submit: {
      userId: publisher_id,
      type: 'task_submit',
      title: '作品已提交',
      taskTitle: title,
      content: `${roleLabel(actor?.role)} ${actor?.realName || ''} 已提交任务「${title}」的作品`,
      taskId: task.id,
      taskGroup: task.task_group,
      publisherId: publisher_id,
      designerId: designer_id
    },
    task_review_pass: {
      userId: designer_id,
      type: 'task_review',
      title: '审核已通过',
      taskTitle: title,
      content: `您的任务「${title}」已通过审核`,
      taskId: task.id,
      taskGroup: task.task_group,
      publisherId: publisher_id,
      designerId: designer_id
    },
    task_review_reject: {
      userId: designer_id,
      type: 'task_reject',
      title: '作品被驳回',
      taskTitle: title,
      content: `您的任务「${title}」已被驳回，请查看驳回原因`,
      taskId: task.id,
      taskGroup: task.task_group,
      publisherId: publisher_id,
      designerId: designer_id
    },
    task_comment: {
      userId: task.publisher_id === actor?.id ? designer_id : publisher_id,
      type: 'task_comment',
      title: '新消息',
      taskTitle: title,
      content: `${actor?.realName || ''} 在任务「${title}」中发表了评论`,
      taskId: task.id,
      taskGroup: task.task_group,
      publisherId: publisher_id,
      designerId: designer_id
    }
  };

  const config = eventConfig[eventType];
  if (config && config.userId) {
    await sendNotification(config);
  }
}

module.exports = { sendNotification, notifyTaskEvent };
