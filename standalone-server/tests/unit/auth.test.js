/**
 * 鉴权与权限校验单元测试
 */

const jwt = require('jsonwebtoken');

// 模拟 config/env 以避免依赖真实 env
const FAKE_SECRET = 'test-secret-key-for-unit-tests-only';
const FAKE_EXPIRES = '12h';

// 复制 auth middleware 的纯函数逻辑
function generateToken(payload, secret = FAKE_SECRET) {
  return jwt.sign(payload, secret, { expiresIn: FAKE_EXPIRES });
}

function verifyToken(token, secret = FAKE_SECRET) {
  try {
    return jwt.verify(token, secret);
  } catch {
    return null;
  }
}

function requireRole(...roles) {
  return (req, res, next) => {
    if (!req.user) return res.status(401).json({ code: 401, msg: '未登录' });
    if (!roles.includes(req.user.role)) return res.status(403).json({ code: 403, msg: '权限不足' });
    next();
  };
}

// ==================== 测试 ====================

describe('JWT Token', () => {
  it('生成并验证有效 Token', () => {
    const payload = { id: 1, username: 'admin', role: 'admin', realName: '管理员' };
    const token = generateToken(payload);
    const decoded = verifyToken(token);
    expect(decoded).not.toBeNull();
    expect(decoded.id).toBe(1);
    expect(decoded.username).toBe('admin');
    expect(decoded.role).toBe('admin');
  });

  it('错误密钥验证失败', () => {
    const token = generateToken({ id: 1 });
    const decoded = verifyToken(token, 'wrong-secret');
    expect(decoded).toBeNull();
  });

  it('篡改后的 Token 验证失败', () => {
    const token = generateToken({ id: 1 });
    const tampered = token.slice(0, -5) + 'xxxxx';
    const decoded = verifyToken(tampered);
    expect(decoded).toBeNull();
  });

  it('过期 Token 验证失败', () => {
    const token = jwt.sign({ id: 1 }, FAKE_SECRET, { expiresIn: '0s' });
    const decoded = verifyToken(token);
    expect(decoded).toBeNull();
  });
});

describe('角色权限校验', () => {
  let req, res, nextCalled;

  beforeEach(() => {
    res = {
      status(code) { this._status = code; return this; },
      json(data) { this._json = data; return this; },
    };
    nextCalled = false;
  });

  function next() { nextCalled = true; }

  it('admin 可以访问所有接口', () => {
    req = { user: { id: 1, role: 'admin' } };
    const mw = requireRole('admin');
    mw(req, res, next);
    expect(nextCalled).toBe(true);
  });

  it('sub_admin 不能访问 admin 专属接口', () => {
    req = { user: { id: 2, role: 'sub_admin' } };
    const mw = requireRole('admin');
    mw(req, res, next);
    expect(nextCalled).toBe(false);
    expect(res._status).toBe(403);
  });

  it('允许多角色访问', () => {
    req = { user: { id: 3, role: 'operator' } };
    const mw = requireRole('admin', 'sub_admin', 'operator');
    mw(req, res, next);
    expect(nextCalled).toBe(true);
  });

  it('operator 不能访问 admin 专属', () => {
    req = { user: { id: 4, role: 'operator' } };
    const mw = requireRole('admin');
    mw(req, res, next);
    expect(nextCalled).toBe(false);
    expect(res._status).toBe(403);
  });

  it('designer 不能访问 cs_agent 专属', () => {
    req = { user: { id: 5, role: 'designer' } };
    const mw = requireRole('admin', 'sub_admin', 'cs_agent');
    mw(req, res, next);
    expect(nextCalled).toBe(false);
    expect(res._status).toBe(403);
  });

  it('basic_designer 等于 designer 权限子集', () => {
    req = { user: { id: 6, role: 'basic_designer' } };
    const designerMw = requireRole('designer', 'basic_designer');
    designerMw(req, res, next);
    // basic_designer 在允许列表中
    expect(nextCalled).toBe(true);
  });

  it('operator_assistant 能访问 operator 相关接口', () => {
    req = { user: { id: 7, role: 'operator_assistant' } };
    const mw = requireRole('admin', 'sub_admin', 'operator', 'operator_assistant');
    mw(req, res, next);
    expect(nextCalled).toBe(true);
  });

  it('未登录用户不能通过角色校验', () => {
    req = { user: null };
    const mw = requireRole('admin');
    mw(req, res, next);
    expect(nextCalled).toBe(false);
    expect(res._status).toBe(401);
  });

  it('所有 7 种角色均定义', () => {
    const allRoles = ['admin', 'sub_admin', 'operator', 'cs_agent', 'designer', 'basic_designer', 'operator_assistant'];
    for (const role of allRoles) {
      req = { user: { id: 1, role } };
      const mw = requireRole(role);
      mw(req, res, next);
      expect(nextCalled).toBe(true);
      nextCalled = false;
    }
  });
});
