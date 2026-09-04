const {
  eligibleTasksForUser,
  resolveBatchFiles
} = require('../../services/batch-submit.service');

function file(name, type = 'image/png', clientId = name) {
  return { clientId, name, size: 1024, type };
}

function task(id, taskNo, wangwangId, extra = {}) {
  return {
    id,
    task_no: taskNo,
    title: `任务${id}`,
    wangwang_id: wangwangId,
    status: 'accepted',
    task_group: 'cs',
    designer_id: 9,
    publisher_name: `客服${id}`,
    ...extra
  };
}

test('matched task includes publisher name for the batch submission UI', () => {
  const result = resolveBatchFiles([file('C202609030001_主图.png')], [
    task(1, 'C202609030001', '旺旺甲', { publisher_name: '客服甲' })
  ]);

  expect(result.groups[0]).toMatchObject({
    taskId: 1,
    taskNo: 'C202609030001',
    publisherName: '客服甲'
  });
});

test('full task number wins even when filename also contains a wangwang id', () => {
  const tasks = [task(1, 'C202609030001', '旺旺甲'), task(2, 'C202609030002', '旺旺乙')];
  const result = resolveBatchFiles([file('C202609030001_旺旺乙_完成.png')], tasks);

  expect(result.unresolved).toHaveLength(0);
  expect(result.groups).toHaveLength(1);
  expect(result.groups[0]).toMatchObject({ taskId: 1, taskNo: 'C202609030001' });
  expect(result.groups[0].files[0].matchedBy).toBe('task_no');
});

test('unique wangwang id is used only when no task number exists', () => {
  const tasks = [task(1, 'C202609030001', '旺旺甲'), task(2, 'C202609030002', '旺旺乙')];
  const result = resolveBatchFiles([file('旺旺乙_主图.png')], tasks);

  expect(result.unresolved).toHaveLength(0);
  expect(result.groups[0]).toMatchObject({ taskId: 2, wangwangId: '旺旺乙' });
  expect(result.groups[0].files[0].matchedBy).toBe('wangwang_id');
});

test('duplicate wangwang ids return conflict', () => {
  const tasks = [task(1, 'C202609030001', '同一旺旺'), task(2, 'C202609030002', '同一旺旺')];
  const result = resolveBatchFiles([file('同一旺旺_成品.png')], tasks);

  expect(result.groups).toHaveLength(0);
  expect(result.unresolved[0]).toMatchObject({ reason: 'duplicate_wangwang' });
});

test('multiple task numbers return conflict', () => {
  const tasks = [task(1, 'C202609030001', '旺旺甲'), task(2, 'C202609030002', '旺旺乙')];
  const result = resolveBatchFiles([file('C202609030001_C202609030002.png')], tasks);

  expect(result.groups).toHaveLength(0);
  expect(result.unresolved[0]).toMatchObject({ reason: 'multiple_task_numbers' });
});

test('doing finished foreign and non-cs tasks are not candidates', () => {
  const tasks = [
    task(1, 'C202609030001', '可提交'),
    task(2, 'C202609030002', '待审核', { status: 'doing' }),
    task(3, 'C202609030003', '已完成', { status: 'finished' }),
    task(4, 'C202609030004', '他人任务', { designer_id: 10 }),
    task(5, 'D202609030005', '运营任务', { task_group: 'design' }),
    task(6, 'C202609030006', '驳回任务', { status: 'rejected' })
  ];

  expect(eligibleTasksForUser(tasks, 9).map(item => item.id)).toEqual([1, 6]);
  const result = resolveBatchFiles([
    file('C202609030002.png'),
    file('C202609030003.png'),
    file('C202609030004.png'),
    file('D202609030005.png')
  ], eligibleTasksForUser(tasks, 9));
  expect(result.groups).toHaveLength(0);
  expect(result.unresolved.map(item => item.reason)).toEqual(['not_found', 'not_found', 'not_found', 'not_found']);
});
