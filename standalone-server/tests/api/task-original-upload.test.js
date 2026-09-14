const request = require('supertest');
const { setupApp } = require('./helpers/setup');

let app;
let execute;
let adminToken;
let publisherToken;
let otherPublisherToken;
let basicToken;
let otherBasicToken;
let publisherId;
let basicId;
let otherBasicId;

const suffix = Date.now();
const taskPrefix = `CS-ORIGINAL-${suffix}`;
const users = {
  publisher: `cs_original_publisher_${suffix}`,
  otherPublisher: `cs_original_other_publisher_${suffix}`,
  basic: `cs_original_basic_${suffix}`,
  otherBasic: `cs_original_other_basic_${suffix}`,
  allReviewer: `cs_original_all_reviewer_${suffix}`
};

async function login(username, password = 'test123456') {
  const response = await request(app).post('/api/auth/login').send({ username, password });
  expect(response.body.code).toBe(0);
  return response.body.data.token;
}

async function createUser(username, realName, role, store = '') {
  const response = await request(app)
    .post('/api/user/create')
    .set('Authorization', `Bearer ${adminToken}`)
    .send({ username, password: 'test123456', realName, role, store });
  expect(response.body.code).toBe(0);
  const list = await request(app)
    .get(`/api/user/list?role=${role}&pageSize=100`)
    .set('Authorization', `Bearer ${adminToken}`);
  return Number(list.body.data.list.find(user => user.username === username).id);
}

async function createTask({ taskGroup = 'cs', status = 'doing', designerId = basicId } = {}) {
  const taskNo = `${taskPrefix}-${Date.now()}-${Math.random().toString(16).slice(2)}`;
  const [result] = await execute(
    `INSERT INTO task_info
       (task_no, title, status, publisher_id, publisher_name, designer_id,
        designer_name, task_group, applied_score, score_review_status)
     VALUES (?, ?, ?, ?, '客服甲', ?, '基础美工甲', ?, 2.5, '')`,
    [taskNo, `${taskNo} task`, status, publisherId, designerId, taskGroup]
  );
  return Number(result.insertId);
}

async function getTask(taskId) {
  const [rows] = await execute('SELECT * FROM task_info WHERE id = ?', [taskId]);
  return rows[0];
}

async function addOriginalFile(taskId, name = 'original.psd') {
  await execute(
    `INSERT INTO task_file
       (task_id, file_name, file_path, file_size, file_type, mime_type, uploader_id, file_category)
     VALUES (?, ?, ?, 8, 'attachment', 'application/octet-stream', ?, 'original')`,
    [taskId, name, `cs/test/${taskId}-${name}`, basicId]
  );
}

async function addWorkImage(taskId, name) {
  const [result] = await execute(
    `INSERT INTO task_file
       (task_id, file_name, file_path, file_size, file_type, mime_type, uploader_id, file_category)
     VALUES (?, ?, ?, 8, 'image', 'image/png', ?, 'work')`,
    [taskId, name, `cs/test/${taskId}-${name}`, basicId]
  );
  return Number(result.insertId);
}

beforeAll(async () => {
  process.env.DISABLE_RATE_LIMIT = '1';
  app = await setupApp();
  ({ execute } = require('../../config/database'));
  adminToken = await login('admin', 'admin123');
  publisherId = await createUser(users.publisher, '客服甲', 'cs_agent', '原图审核A店');
  await createUser(users.otherPublisher, '客服乙', 'cs_agent', '原图审核A店');
  basicId = await createUser(users.basic, '基础美工甲', 'basic_designer');
  otherBasicId = await createUser(users.otherBasic, '基础美工乙', 'basic_designer');
  await createUser(users.allReviewer, '客服丙', 'cs_agent', '原图审核B店');
  publisherToken = await login(users.publisher);
  otherPublisherToken = await login(users.otherPublisher);
  basicToken = await login(users.basic);
  otherBasicToken = await login(users.otherBasic);
}, 30000);

beforeEach(async () => {
  await execute(
    'DELETE FROM task_file WHERE task_id IN (SELECT id FROM task_info WHERE task_no LIKE ?)',
    [`${taskPrefix}%`]
  );
  await execute('DELETE FROM task_info WHERE task_no LIKE ?', [`${taskPrefix}%`]);
});

test('客服通过后进入待上传原图且不提前进入分值审核', async () => {
  const taskId = await createTask();
  const response = await request(app)
    .post('/api/task/review')
    .set('Authorization', `Bearer ${publisherToken}`)
    .send({ taskId, action: 'pass' });

  expect(response.body.code).toBe(0);
  expect(response.body.msg).toContain('上传原图');
  expect(await getTask(taskId)).toMatchObject({
    status: 'pending_original',
    score_review_status: ''
  });
});

test('客服单条通过可保存跨修改轮次的最终效果图选择', async () => {
  const taskId = await createTask();
  const firstId = await addWorkImage(taskId, '首次.png');
  const secondId = await addWorkImage(taskId, '修改.png');
  const [recordResult] = await execute(
    `INSERT INTO task_reject_record
       (task_id, reject_index, reviewer_id, reviewer_name, reject_reason, designer_complete_time)
     VALUES (?, 1, ?, '客服甲', '调整构图', CURRENT_TIMESTAMP)`,
    [taskId, publisherId]
  );
  await execute('UPDATE task_file SET reject_record_id = ? WHERE id = ?', [recordResult.insertId, secondId]);

  const response = await request(app)
    .post('/api/task/review')
    .set('Authorization', `Bearer ${publisherToken}`)
    .send({ taskId, action: 'pass', effectFileIds: [firstId, secondId] });

  expect(response.body.code).toBe(0);
  expect((await getTask(taskId)).selected_effect_file_ids).toBe(JSON.stringify([firstId, secondId]));
  const detail = await request(app)
    .get(`/api/task/detail?taskId=${taskId}`)
    .set('Authorization', `Bearer ${publisherToken}`);
  expect(detail.body.data.files).toEqual(expect.arrayContaining([
    expect.objectContaining({ id: firstId, is_selected_effect: true }),
    expect.objectContaining({ id: secondId, is_selected_effect: true })
  ]));
});

test('原图可分批上传，完成上传后进入待审核原图且不提前进入分值审核', async () => {
  const taskId = await createTask({ status: 'pending_original' });
  const firstOriginalName = '源文件";\u007f A.psd';
  const secondOriginalName = '源文件B.zip';
  const first = await request(app)
    .post('/api/task/upload-original')
    .set('Authorization', `Bearer ${basicToken}`)
    .field('taskId', String(taskId))
    .field('originalFileNames', JSON.stringify([firstOriginalName]))
    .attach('files', Buffer.from('psd source'), 'nexus-upload-1.psd');
  const second = await request(app)
    .post('/api/task/upload-original')
    .set('Authorization', `Bearer ${basicToken}`)
    .field('taskId', String(taskId))
    .field('originalFileNames', JSON.stringify([secondOriginalName]))
    .attach('files', Buffer.from('zip source'), 'nexus-upload-1.zip');

  expect([first.body.code, second.body.code]).toEqual([0, 0]);
  expect((await getTask(taskId)).status).toBe('pending_original');
  const [files] = await execute(
    `SELECT file_name, file_category FROM task_file WHERE task_id = ? ORDER BY id`,
    [taskId]
  );
  expect(files).toEqual([
    expect.objectContaining({ file_name: firstOriginalName, file_category: 'original' }),
    expect.objectContaining({ file_name: secondOriginalName, file_category: 'original' })
  ]);

  const completed = await request(app)
    .post('/api/task/complete-original-upload')
    .set('Authorization', `Bearer ${basicToken}`)
    .send({ taskId });
  expect(completed.body.code).toBe(0);
  expect(await getTask(taskId)).toMatchObject({
    status: 'pending_original_review',
    finish_time: null,
    score_review_status: ''
  });
});

test('没有原图、错误人员和错误状态都不能完成或上传原图', async () => {
  const pendingTaskId = await createTask({ status: 'pending_original' });
  const doingTaskId = await createTask({ status: 'doing' });
  const designTaskId = await createTask({ taskGroup: 'design', status: 'pending_original' });

  const [empty, foreign, wrongStatus, wrongGroup] = await Promise.all([
    request(app).post('/api/task/complete-original-upload')
      .set('Authorization', `Bearer ${basicToken}`).send({ taskId: pendingTaskId }),
    request(app).post('/api/task/upload-original')
      .set('Authorization', `Bearer ${otherBasicToken}`).field('taskId', String(pendingTaskId))
      .attach('files', Buffer.from('foreign'), 'foreign.psd'),
    request(app).post('/api/task/upload-original')
      .set('Authorization', `Bearer ${basicToken}`).field('taskId', String(doingTaskId))
      .attach('files', Buffer.from('doing'), 'doing.psd'),
    request(app).post('/api/task/upload-original')
      .set('Authorization', `Bearer ${basicToken}`).field('taskId', String(designTaskId))
      .attach('files', Buffer.from('design'), 'design.psd')
  ]);

  expect([empty.body.code, foreign.body.code, wrongStatus.body.code, wrongGroup.body.code])
    .toEqual([400, 403, 400, 400]);
  expect((await getTask(pendingTaskId)).status).toBe('pending_original');
});

test('其他客服不能审核非本人发布的任务', async () => {
  const taskId = await createTask();
  const response = await request(app)
    .post('/api/task/review')
    .set('Authorization', `Bearer ${otherPublisherToken}`)
    .send({ taskId, action: 'pass' });
  expect(response.body.code).toBe(403);
  expect((await getTask(taskId)).status).toBe('doing');
});

test('全部审核权限可跨发布人查看并审核原图', async () => {
  const allTaskId = await createTask({ status: 'pending_original_review' });
  await addOriginalFile(allTaskId, 'all-review.psd');

  const usersResponse = await request(app)
    .get('/api/user/list?role=cs_agent&pageSize=100')
    .set('Authorization', `Bearer ${adminToken}`);
  const byUsername = new Map(usersResponse.body.data.list.map(user => [user.username, user]));
  const allReviewer = byUsername.get(users.allReviewer);

  const saved = await request(app)
    .post('/api/user/permissions/save')
    .set('Authorization', `Bearer ${adminToken}`)
    .send({
      userId: allReviewer.id,
      permissions: ['cs.review.basic', 'task.review.all'],
      deniedPermissions: []
    });
  expect(saved.body.code).toBe(0);

  const allReviewerToken = await login(users.allReviewer);
  const allList = await request(app)
    .get('/api/task/my-published?taskGroup=cs&status=pending_original_review&reviewView=true&pageSize=20')
    .set('Authorization', `Bearer ${allReviewerToken}`);
  expect(allList.body.data.list.map(task => Number(task.id))).toContain(allTaskId);

  const allReview = await request(app)
    .post('/api/task/review-original')
    .set('Authorization', `Bearer ${allReviewerToken}`)
    .send({ taskId: allTaskId, action: 'pass' });
  expect(allReview.body.code).toBe(0);
});

test('批量审核只处理效果图待审核任务并保持原图审核独立', async () => {
  const doingTaskId = await createTask({ status: 'doing' });
  const originalReviewTaskId = await createTask({ status: 'pending_original_review' });
  await addOriginalFile(originalReviewTaskId);

  const list = await request(app)
    .get('/api/task/my-published?taskGroup=cs&status=doing,pending_original_review&pageSize=20&selfOnly=true')
    .set('Authorization', `Bearer ${publisherToken}`);
  expect(list.body.code).toBe(0);
  expect(list.body.data.list.find(task => Number(task.id) === doingTaskId).allowedActions).toMatchObject({
    review: true,
    reviewOriginal: false
  });
  expect(list.body.data.list.find(task => Number(task.id) === originalReviewTaskId).allowedActions).toMatchObject({
    review: false,
    reviewOriginal: true
  });

  const response = await request(app)
    .post('/api/task/batch-review')
    .set('Authorization', `Bearer ${publisherToken}`)
    .send({ taskIds: [doingTaskId, originalReviewTaskId] });

  expect(response.body.code).toBe(0);
  expect(response.body.data.count).toBe(1);
  expect((await getTask(doingTaskId)).status).toBe('pending_original');
  expect((await getTask(originalReviewTaskId)).status).toBe('pending_original_review');
});

test('客服审核原图通过后任务才完成并进入分值审核', async () => {
  const taskId = await createTask({ status: 'pending_original_review' });
  await addOriginalFile(taskId);

  const response = await request(app)
    .post('/api/task/review-original')
    .set('Authorization', `Bearer ${publisherToken}`)
    .send({ taskId, action: 'pass' });

  expect(response.body.code).toBe(0);
  expect(await getTask(taskId)).toMatchObject({ status: 'finished', score_review_status: 'pending' });
  expect((await getTask(taskId)).finish_time).toBeTruthy();
});

test('客服审核原图不通过后回到待上传且保留原图文件', async () => {
  const taskId = await createTask({ status: 'pending_original_review' });
  await addOriginalFile(taskId, 'rejected-original.psd');

  const response = await request(app)
    .post('/api/task/review-original')
    .set('Authorization', `Bearer ${publisherToken}`)
    .send({ taskId, action: 'reject' });

  expect(response.body.code).toBe(0);
  expect((await getTask(taskId)).status).toBe('pending_original');
  const [files] = await execute(
    `SELECT id FROM task_file WHERE task_id = ? AND file_category = 'original'`,
    [taskId]
  );
  expect(files).toHaveLength(0);
});

test('基础美工可在待审核原图时撤回且保留文件', async () => {
  const taskId = await createTask({ status: 'pending_original_review' });
  await addOriginalFile(taskId, 'withdrawn-original.psd');

  const response = await request(app)
    .post('/api/task/withdraw-original')
    .set('Authorization', `Bearer ${basicToken}`)
    .send({ taskId });

  expect(response.body.code).toBe(0);
  expect((await getTask(taskId)).status).toBe('pending_original');
  const [files] = await execute('SELECT id FROM task_file WHERE task_id = ?', [taskId]);
  expect(files).toHaveLength(0);

  const uploaded = await request(app)
    .post('/api/task/upload-original')
    .set('Authorization', `Bearer ${basicToken}`)
    .field('taskId', String(taskId))
    .field('originalFileNames', JSON.stringify(['replacement-original.psd']))
    .attach('files', Buffer.from('replacement'), 'replacement-upload.psd');
  expect(uploaded.body.code).toBe(0);

  const [replacementFiles] = await execute(
    'SELECT file_name FROM task_file WHERE task_id = ? AND file_category = ? ORDER BY id',
    [taskId, 'original']
  );
  expect(replacementFiles).toEqual([
    expect.objectContaining({ file_name: 'replacement-original.psd' })
  ]);
});

test('待审核原图不能转移给其他基础美工', async () => {
  const taskId = await createTask({ status: 'pending_original_review' });
  await addOriginalFile(taskId, 'not-transferable.psd');

  const response = await request(app)
    .post('/api/task/transfer')
    .set('Authorization', `Bearer ${basicToken}`)
    .send({ taskId, newDesignerId: otherBasicId, reason: '不应允许转移' });

  expect(response.body.code).toBe(400);
  expect(await getTask(taskId)).toMatchObject({
    status: 'pending_original_review',
    designer_id: basicId
  });
});

test('没有上传权限时不暴露原图撤回动作且接口拒绝', async () => {
  const taskId = await createTask({ status: 'pending_original_review' });
  await addOriginalFile(taskId, 'permission-guard.psd');
  const { generateAccessToken } = require('../../middleware/auth');
  const restrictedToken = generateAccessToken({
    id: basicId,
    username: users.basic,
    realName: '基础美工甲',
    role: 'basic_designer',
    permissions: ['basic.tasks.cs']
  });

  const detail = await request(app)
    .get(`/api/task/detail?taskId=${taskId}`)
    .set('Authorization', `Bearer ${restrictedToken}`);
  expect(detail.body.data.allowedActions.withdrawOriginal).toBe(false);

  const response = await request(app)
    .post('/api/task/withdraw-original')
    .set('Authorization', `Bearer ${restrictedToken}`)
    .send({ taskId });
  expect(response.body.code).toBe(403);
  expect((await getTask(taskId)).status).toBe('pending_original_review');
});

test('其他客服和其他基础美工不能审核或撤回原图', async () => {
  const taskId = await createTask({ status: 'pending_original_review' });
  await addOriginalFile(taskId);

  const [review, withdraw] = await Promise.all([
    request(app).post('/api/task/review-original')
      .set('Authorization', `Bearer ${otherPublisherToken}`).send({ taskId, action: 'pass' }),
    request(app).post('/api/task/withdraw-original')
      .set('Authorization', `Bearer ${otherBasicToken}`).send({ taskId })
  ]);

  expect([review.body.code, withdraw.body.code]).toEqual([403, 403]);
  expect((await getTask(taskId)).status).toBe('pending_original_review');
});

test('错误状态、无原图和重复原图审核都被拒绝', async () => {
  const doingTaskId = await createTask({ status: 'doing' });
  const noFileTaskId = await createTask({ status: 'pending_original_review' });
  const reviewedTaskId = await createTask({ status: 'pending_original_review' });
  await addOriginalFile(reviewedTaskId);

  const wrongStatus = await request(app).post('/api/task/review-original')
    .set('Authorization', `Bearer ${publisherToken}`).send({ taskId: doingTaskId, action: 'pass' });
  const noFile = await request(app).post('/api/task/review-original')
    .set('Authorization', `Bearer ${publisherToken}`).send({ taskId: noFileTaskId, action: 'pass' });
  const first = await request(app).post('/api/task/review-original')
    .set('Authorization', `Bearer ${publisherToken}`).send({ taskId: reviewedTaskId, action: 'pass' });
  const repeated = await request(app).post('/api/task/review-original')
    .set('Authorization', `Bearer ${publisherToken}`).send({ taskId: reviewedTaskId, action: 'pass' });
  const repeatedComplete = await request(app).post('/api/task/complete-original-upload')
    .set('Authorization', `Bearer ${basicToken}`).send({ taskId: reviewedTaskId });

  expect([wrongStatus.body.code, noFile.body.code, first.body.code, repeated.body.code, repeatedComplete.body.code])
    .toEqual([400, 400, 0, 400, 400]);
});
