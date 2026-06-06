/**
 * 任务状态流转单元测试
 * 验证合法/非法状态转换
 */

// 任务状态机：有效转换映射
// 格式: { from: [valid_to_states] }
const VALID_TRANSITIONS = {
  draft:   ['wait'],
  wait:    ['accepted', 'draft'],
  accepted: ['doing', 'draft'],
  doing:   ['finished', 'rejected', 'accepted'],
  rejected: ['doing'],
  finished: [],
};

const ALL_STATUSES = ['draft', 'wait', 'accepted', 'doing', 'submitted', 'finished', 'rejected'];

function isValidTransition(from, to) {
  const valid = VALID_TRANSITIONS[from];
  if (!valid) return false;
  return valid.includes(to);
}

function canAcceptTask(status) {
  return status === 'wait';
}

function canSubmitTask(status) {
  return status === 'accepted' || status === 'doing' || status === 'rejected';
}

function canReviewTask(status) {
  return status === 'doing' || status === 'submitted';
}

function canWithdrawTask(status) {
  return status === 'wait' || status === 'accepted';
}

function canUndoSubmit(status) {
  return status === 'doing';
}

function canDeleteTask(status) {
  return status !== 'finished';
}

function canTransferTask(status) {
  return status !== 'finished';
}

// ==================== 测试 ====================

describe('任务状态机', () => {
  describe('状态转换规则', () => {
    it('wait 可以被接单转换为 accepted', () => {
      expect(isValidTransition('wait', 'accepted')).toBe(true);
    });

    it('wait 可以被撤回为 draft', () => {
      expect(isValidTransition('wait', 'draft')).toBe(true);
    });

    it('accepted 可以转为 doing', () => {
      expect(isValidTransition('accepted', 'doing')).toBe(true);
    });

    it('accepted 可以转为 draft', () => {
      expect(isValidTransition('accepted', 'draft')).toBe(true);
    });

    it('doing 可以审核通过转为 finished', () => {
      expect(isValidTransition('doing', 'finished')).toBe(true);
    });

    it('doing 可以驳回转为 rejected', () => {
      expect(isValidTransition('doing', 'rejected')).toBe(true);
    });

    it('doing 可以撤销提交回到 accepted', () => {
      expect(isValidTransition('doing', 'accepted')).toBe(true);
    });

    it('rejected 可以重新提交转为 doing', () => {
      expect(isValidTransition('rejected', 'doing')).toBe(true);
    });

    it('finished 不能再转换到任何状态', () => {
      for (const s of ALL_STATUSES) {
        expect(isValidTransition('finished', s)).toBe(false);
      }
    });
  });

  describe('非法转换', () => {
    it('wait 不能直接到 finished', () => {
      expect(isValidTransition('wait', 'finished')).toBe(false);
    });

    it('accepted 不能直接到 finished', () => {
      expect(isValidTransition('accepted', 'finished')).toBe(false);
    });

    it('doing 不能回到 wait', () => {
      expect(isValidTransition('doing', 'wait')).toBe(false);
    });

    it('finished 不能回到 doing', () => {
      expect(isValidTransition('finished', 'doing')).toBe(false);
    });

    it('draft 不能直接到 doing', () => {
      expect(isValidTransition('draft', 'doing')).toBe(false);
    });
  });

  describe('业务条件判断', () => {
    it('只有 wait 状态可以接单', () => {
      expect(canAcceptTask('wait')).toBe(true);
      expect(canAcceptTask('accepted')).toBe(false);
      expect(canAcceptTask('doing')).toBe(false);
      expect(canAcceptTask('finished')).toBe(false);
    });

    it('accepted/doing/rejected 可以提交作品', () => {
      expect(canSubmitTask('accepted')).toBe(true);
      expect(canSubmitTask('doing')).toBe(true);
      expect(canSubmitTask('rejected')).toBe(true);
      expect(canSubmitTask('wait')).toBe(false);
      expect(canSubmitTask('finished')).toBe(false);
    });

    it('只有 doing 可以审核', () => {
      expect(canReviewTask('doing')).toBe(true);
      expect(canReviewTask('submitted')).toBe(true);
      expect(canReviewTask('wait')).toBe(false);
      expect(canReviewTask('finished')).toBe(false);
    });

    it('只有 wait/accepted 可以撤回', () => {
      expect(canWithdrawTask('wait')).toBe(true);
      expect(canWithdrawTask('accepted')).toBe(true);
      expect(canWithdrawTask('doing')).toBe(false);
    });

    it('只有 doing 可以撤销提交', () => {
      expect(canUndoSubmit('doing')).toBe(true);
      expect(canUndoSubmit('accepted')).toBe(false);
    });

    it('finished 不可删除', () => {
      expect(canDeleteTask('finished')).toBe(false);
      expect(canDeleteTask('wait')).toBe(true);
      expect(canDeleteTask('doing')).toBe(true);
    });

    it('finished 不可转移', () => {
      expect(canTransferTask('finished')).toBe(false);
      expect(canTransferTask('accepted')).toBe(true);
    });
  });

  describe('submitted 别名说明', () => {
    // 当前后端实现：finishTask 将状态设为 'doing'
    // 前端用 'doing' 同时表示 "已提交待审核" 和 "作图中"
    // 'submitted' 不是独立状态，而是 'doing' 的语义别名

    it('doing 状态可以审核', () => {
      expect(canReviewTask('doing')).toBe(true);
    });

    it('accepted 状态不能审核（必须先提交）', () => {
      expect(canReviewTask('accepted')).toBe(false);
    });

    it('rejected 状态不能审核（必须先重新提交）', () => {
      expect(canReviewTask('rejected')).toBe(false);
    });
  });

  describe('完整生命周期路径', () => {
    it('正常路径: draft→wait→accepted→doing→finished', () => {
      expect(isValidTransition('draft', 'wait')).toBe(true);
      expect(isValidTransition('wait', 'accepted')).toBe(true);
      expect(isValidTransition('accepted', 'doing')).toBe(true);
      expect(isValidTransition('doing', 'finished')).toBe(true);
    });

    it('驳回路径: doing→rejected→doing→finished', () => {
      expect(isValidTransition('doing', 'rejected')).toBe(true);
      expect(isValidTransition('rejected', 'doing')).toBe(true);
      expect(isValidTransition('doing', 'finished')).toBe(true);
    });

    it('撤回路径: wait→draft 和 accepted→draft', () => {
      expect(isValidTransition('wait', 'draft')).toBe(true);
      expect(isValidTransition('accepted', 'draft')).toBe(true);
    });

    it('撤销提交: doing→accepted', () => {
      expect(isValidTransition('doing', 'accepted')).toBe(true);
    });

    it('finished 是终态，不可再转换', () => {
      expect(isValidTransition('finished', 'doing')).toBe(false);
      expect(isValidTransition('finished', 'rejected')).toBe(false);
      expect(isValidTransition('finished', 'accepted')).toBe(false);
    });
  });
});
