const AppError = require('../../utils/AppError');
const { execute, executeTransaction } = require('../../config/database');
const { sendNotification } = require('../../utils/notification');
const repository = require('./repository');
const recordService = require('./record.service');
const { canUseManagerReview, canReviewStore, canManageAllPaymentData } = require('./access');
const { conflictError } = require('./optimistic-lock');

const REJECTION_REASON = '店长未确认开启付费';
const NOTIFICATION_TYPE = 'payment_manager_review';

function normalizeId(value) {
  const id = Number(value);
  if (!Number.isInteger(id) || id < 1) throw new AppError(400, '无效的审核申请');
  return id;
}

function assertReviewer(user) {
  if (!canUseManagerReview(user)) throw new AppError(403, '只有店长或管理员可以处理审核');
}

function assertRequestStore(request, user) {
  if (!canReviewStore(user, request.store)) throw new AppError(403, '无权审核其他店铺的记录');
}

function presentRequest(request) {
  return {
    id: request.id,
    recordId: request.record_id,
    store: request.store,
    storeSeq: request.store_seq,
    applicantId: request.applicant_id,
    applicantName: request.applicant_name,
    requestVersion: request.request_version,
    styleNumber: request.style_number || '',
    productId: request.product_id || '',
    sourceTaskNo: request.source_task_no || '',
    plannerName: request.planner_name || request.applicant_name || '',
    currentStage: request.current_stage || 'testing',
    createdAt: request.create_time,
    recordCreatedAt: request.record_create_time
  };
}

async function notifyReviewers(review) {
  try {
    const [users] = await execute(
      `SELECT DISTINCT u.id
       FROM sys_user u
       WHERE u.status = 1
         AND (
           u.role IN ('admin', 'sub_admin')
           OR (u.is_store_manager = 1 AND u.store = ?)
           OR EXISTS (
             SELECT 1 FROM sys_user_permission allowed
             WHERE allowed.user_id = u.id
               AND allowed.permission_code = 'payment.manage.all'
               AND allowed.effect = 'allow'
               AND NOT EXISTS (
                 SELECT 1 FROM sys_user_permission denied
                 WHERE denied.user_id = u.id
                   AND denied.permission_code = 'payment.manage.all'
                   AND denied.effect = 'deny'
               )
           )
         )`,
      [review.store]
    );
    const styleNumber = review.styleNumber || '未填写货号';
    await Promise.all(users.map(item => sendNotification({
      userId: item.id,
      type: NOTIFICATION_TYPE,
      title: '新的店长付费审核',
      content: `${review.applicantName || '填写人'}提交了店铺“${review.store || '-'}”货号“${styleNumber}”的付费审核`
    })));
    return true;
  } catch (error) {
    console.error('[PaymentManagerReview] 发送审核待办通知失败:', error);
    return false;
  }
}

async function notifyApplicant(decision) {
  if (!decision.applicantId) return false;
  try {
    const styleNumber = decision.styleNumber || '未填写货号';
    return sendNotification({
      userId: decision.applicantId,
      type: NOTIFICATION_TYPE,
      title: decision.approved ? '店长付费审核已通过' : '店长付费审核未通过',
      content: decision.approved
        ? `货号“${styleNumber}”的店长付费审核已通过，可以继续填写第二阶段`
        : `货号“${styleNumber}”的店长付费审核未通过，流程已按“${REJECTION_REASON}”结束`
    });
  } catch (error) {
    console.error('[PaymentManagerReview] 发送审核结果通知失败:', error);
    return false;
  }
}

function listScope(query, user) {
  const global = canManageAllPaymentData(user) || user?.role === 'sub_admin';
  return {
    store: global ? String(query?.store || '').trim() : user.store,
    keyword: String(query?.keyword || '').trim(),
    page: Math.max(1, parseInt(query?.page, 10) || 1),
    pageSize: Math.min(100, Math.max(1, parseInt(query?.pageSize, 10) || 20))
  };
}

async function listRequests(query, user) {
  assertReviewer(user);
  const filters = listScope(query, user);
  const [rows, total] = await Promise.all([
    repository.listManagerReviewRequests(filters),
    repository.countManagerReviewRequests(filters)
  ]);
  return {
    list: rows.map(presentRequest),
    total,
    page: filters.page,
    pageSize: filters.pageSize,
    totalPages: Math.ceil(total / filters.pageSize)
  };
}

async function countRequests(query, user) {
  assertReviewer(user);
  return { count: await repository.countManagerReviewRequests(listScope(query, user)) };
}

async function getRequestDetail(idValue, user) {
  assertReviewer(user);
  const request = await repository.findManagerReviewRequestById(normalizeId(idValue));
  if (!request) throw new AppError(404, '待审核申请不存在');
  assertRequestStore(request, user);
  const record = await recordService.getRecord(request.record_id, user, {
    skipPermission: true,
    skipViewPermission: true,
    forceReadOnly: true
  });
  return { request: presentRequest(request), record };
}

function normalizePaidAt(value) {
  const paidAt = String(value || '').trim();
  if (!paidAt || Number.isNaN(Date.parse(paidAt.replace(' ', 'T')))) {
    throw new AppError(400, '请选择付费时间');
  }
  return paidAt;
}

async function decide(idValue, payload, user, approved) {
  assertReviewer(user);
  const id = normalizeId(idValue);
  const paidAt = approved ? normalizePaidAt(payload?.paidAt) : null;
  const requestVersion = Number(payload?.requestVersion);

  let recordId;
  let decisionNotification;
  await executeTransaction(async conn => {
    const request = await repository.findManagerReviewRequestById(id, { conn, forUpdate: true });
    if (!request) throw conflictError('审核申请已被处理');
    assertRequestStore(request, user);
    if (!Number.isInteger(requestVersion) || requestVersion !== Number(request.request_version)) {
      throw conflictError('审核申请已更新');
    }

    const record = await repository.findRecordById(request.record_id, { conn, forUpdate: true });
    if (!record || record.process_status !== 'in_progress' || record.current_stage !== 'testing') {
      throw conflictError('记录状态已变化');
    }
    if (Number(record.version) !== Number(request.request_version)) throw conflictError('记录已更新');

    await repository.saveStageData(conn, record.id, 'testing', {
      paid_enabled: approved ? 1 : 0,
      paid_at: paidAt
    });
    if (!approved) await repository.markStageEnded(conn, record.id, 'testing');
    const updated = await repository.updateRecordWithVersion(conn, record.id, record.version, approved ? {} : {
      process_status: 'ended',
      end_stage: 'testing',
      end_type: 'payment_not_enabled',
      end_reason: REJECTION_REASON,
      ended_at: new Date().toISOString().slice(0, 19).replace('T', ' ')
    });
    if (!updated) throw conflictError();
    if (!await repository.deleteManagerReviewRequest(conn, request.id)) throw conflictError('审核申请已被处理');
    recordId = record.id;
    decisionNotification = {
      applicantId: request.applicant_id,
      styleNumber: record.style_number,
      approved
    };
  });

  await notifyApplicant(decisionNotification);

  return recordService.getRecord(recordId, user, {
    skipPermission: true,
    skipViewPermission: true,
    forceReadOnly: true
  });
}

const approveRequest = (id, payload, user) => decide(id, payload, user, true);
const rejectRequest = (id, payload, user) => decide(id, payload, user, false);

module.exports = {
  REJECTION_REASON,
  presentRequest,
  listRequests,
  countRequests,
  getRequestDetail,
  approveRequest,
  rejectRequest,
  notifyReviewers
};
