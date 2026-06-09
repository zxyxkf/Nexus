/**
 * 认证模块路由 - 登录/退出/修改密码
 */

const express = require('express');
const bcrypt = require('bcryptjs');
const rateLimit = require('express-rate-limit');
const router = express.Router();

const { getPool, getMode, executeTransaction } = require('../config/database');
const { generateToken, generateAccessToken, generateRefreshToken, requireAuth, requireRole } = require('../middleware/auth');
const { JWT_REFRESH_EXPIRES_IN } = require('../config/env');
const { writeOperLog } = require('../utils/operLog');
const permissionService = require('../services/permission.service');

// 登录频率限制：5 次/分钟/IP（测试模式放宽）
const isTest = process.env.DISABLE_RATE_LIMIT === '1';
const loginLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: isTest ? 10000 : 30,
  message: { code: 429, msg: '登录请求过于频繁，请1分钟后再试' },
  standardHeaders: true,
  legacyHeaders: false,
});

/**
 * POST /api/auth/login - 用户登录
 */
router.post('/login', loginLimiter, async (req, res, next) => {
  const startTime = Date.now();
  try {
    const { username, password } = req.body;

    if (!username || !password) {
      return res.json({ code: 400, msg: '用户名和密码不能为空' });
    }

    const pool = getPool();
    const [rows] = await pool.execute(
      `SELECT id, username, password, real_name, role, status, store, is_team_lead FROM sys_user WHERE username = ?`,
      [username]
    );

    if (rows.length === 0) {
      // 记录登录失败日志
      writeOperLog({
        username, operation: 'login_fail', module: 'auth',
        resultCode: 401, resultMsg: '用户不存在',
        costTime: Date.now() - startTime
      });
      return res.json({ code: 401, msg: '用户名或密码错误' });
    }

    const user = rows[0];

    // 检查账号状态
    if (user.status === 0) {
      writeOperLog({
        userId: user.id, username: user.username, role: user.role,
        operation: 'login_fail', module: 'auth',
        resultCode: 403, resultMsg: '账号已被禁用',
        costTime: Date.now() - startTime
      });
      return res.json({ code: 403, msg: '账号已被禁用，请联系管理员' });
    }

    // 校验密码
    const isValid = bcrypt.compareSync(password, user.password);
    if (!isValid) {
      writeOperLog({
        userId: user.id, username: user.username, role: user.role,
        operation: 'login_fail', module: 'auth',
        resultCode: 401, resultMsg: '密码错误',
        costTime: Date.now() - startTime
      });
      return res.json({ code: 401, msg: '用户名或密码错误' });
    }

    // 签发 access token + refresh token
    const permissions = await permissionService.getEffectivePermissions(user);
    const accessToken = generateAccessToken({
      id: user.id,
      username: user.username,
      role: user.role,
      realName: user.real_name,
      store: user.store || '',
      isTeamLead: user.is_team_lead || 0,
      permissions
    });
    const refreshToken = generateRefreshToken();

    // 保存 refresh token 到 DB
    const mode = getMode();
    const expiresExpr = mode === 'mysql'
      ? "DATE_ADD(NOW(), INTERVAL 7 DAY)"
      : "datetime('now', '+7 days')";
    await pool.execute(
      `INSERT INTO sys_refresh_token (user_id, token, expires_at) VALUES (?, ?, ${expiresExpr})`,
      [user.id, refreshToken]
    );

    // 更新最后登录时间
    await pool.execute(
      `UPDATE sys_user SET last_login_time = NOW() WHERE id = ?`,
      [user.id]
    );

    // 记录登录成功日志
    writeOperLog({
      userId: user.id, username: user.username, role: user.role,
      operation: 'login', module: 'auth',
      resultCode: 0, resultMsg: '登录成功',
      costTime: Date.now() - startTime
    });

    res.json({
      code: 0,
      msg: '登录成功',
      data: {
        token: accessToken,
        refreshToken,
        user: {
          id: user.id,
          username: user.username,
          realName: user.real_name,
          role: user.role,
          store: user.store || '',
          isTeamLead: user.is_team_lead || 0,
          permissions
        }
      }
    });
  } catch (err) {
    next(err);
  }
});

/**
 * POST /api/auth/refresh — 用 refresh token 换取新的 access token
 */
router.post('/refresh', async (req, res, next) => {
  const startTime = Date.now();
  try {
    const { refreshToken } = req.body;
    if (!refreshToken) {
      return res.json({ code: 400, msg: '缺少 refresh_token' });
    }

    const pool = getPool();

    // 查 DB：token 存在 + 未撤销 + 未过期
    const [rows] = await pool.execute(
      `SELECT rt.id, rt.user_id, rt.expires_at, u.username, u.real_name, u.role, u.status, u.store, u.is_team_lead
       FROM sys_refresh_token rt
       JOIN sys_user u ON u.id = rt.user_id
       WHERE rt.token = ? AND rt.revoked = 0`,
      [refreshToken]
    );

    if (rows.length === 0) {
      return res.json({ code: 401, msg: 'refresh_token 无效或已被撤销，请重新登录' });
    }

    const record = rows[0];

    // 检查过期
    if (new Date(record.expires_at) < new Date()) {
      await pool.execute('DELETE FROM sys_refresh_token WHERE id = ?', [record.id]);
      return res.json({ code: 401, msg: 'refresh_token 已过期，请重新登录' });
    }

    // 检查用户状态
    if (record.status === 0) {
      return res.json({ code: 403, msg: '账号已被禁用' });
    }

    // 签发新的 access token（refresh token 不轮转，避免并发竞态）
    const permissions = await permissionService.getEffectivePermissions({
      id: record.user_id,
      role: record.role,
      isTeamLead: record.is_team_lead || 0
    });

    const accessToken = generateAccessToken({
      id: record.user_id,
      username: record.username,
      role: record.role,
      realName: record.real_name,
      store: record.store || '',
      permissions
    });

    res.json({
      code: 0,
      msg: 'Token 刷新成功',
      data: {
        token: accessToken,
        user: {
          id: record.user_id,
          username: record.username,
          realName: record.real_name,
          role: record.role,
          store: record.store || '',
          permissions
        }
      }
    });
  } catch (err) {
    next(err);
  }
});

/**
 * POST /api/auth/logout — 注销登录，删除 refresh token
 */
router.post('/logout', requireAuth, async (req, res, next) => {
  try {
    const { refreshToken } = req.body;
    const pool = getPool();

    if (refreshToken) {
      await pool.execute(
        'DELETE FROM sys_refresh_token WHERE token = ? AND user_id = ?',
        [refreshToken, req.user.id]
      );
    } else {
      // 未提供 token 则清除该用户所有 refresh token（全部设备下线）
      await pool.execute('DELETE FROM sys_refresh_token WHERE user_id = ?', [req.user.id]);
    }

    res.json({ code: 0, msg: '已退出登录' });
  } catch (err) {
    next(err);
  }
});

/**
 * POST /api/auth/revoke — 管理员强制下线某用户
 */
router.post('/revoke', requireAuth, requireRole('admin', 'sub_admin'), async (req, res, next) => {
  try {
    const { userId } = req.body;
    if (!userId) {
      return res.json({ code: 400, msg: '缺少 userId' });
    }
    const pool = getPool();
    await pool.execute('DELETE FROM sys_refresh_token WHERE user_id = ?', [userId]);

    writeOperLog({
      userId: req.user.id, username: req.user.username, role: req.user.role,
      operation: 'force_logout', module: 'auth', method: 'POST',
      requestUrl: '/api/auth/revoke', requestParams: JSON.stringify({ targetUserId: userId }),
      resultCode: 0, resultMsg: `已强制下线用户 ${userId}`,
      costTime: 0
    });

    res.json({ code: 0, msg: '已强制下线' });
  } catch (err) {
    next(err);
  }
});

/**
 * POST /api/auth/password - 修改密码
 */
router.post('/password', requireAuth, async (req, res, next) => {
  const startTime = Date.now();
  try {
    const { oldPassword, newPassword } = req.body;

    if (!oldPassword || !newPassword) {
      return res.json({ code: 400, msg: '旧密码和新密码不能为空' });
    }

    if (newPassword.length < 6) {
      return res.json({ code: 400, msg: '新密码长度不能少于6位' });
    }

    const pool = getPool();
    const [rows] = await pool.execute(
      `SELECT password FROM sys_user WHERE id = ?`,
      [req.user.id]
    );

    if (!bcrypt.compareSync(oldPassword, rows[0].password)) {
      writeOperLog({
        userId: req.user.id, username: req.user.username, role: req.user.role,
        operation: 'change_pwd_fail', module: 'auth',
        method: 'POST', requestUrl: '/api/auth/password',
        resultCode: 400, resultMsg: '旧密码错误',
        costTime: Date.now() - startTime
      });
      return res.json({ code: 400, msg: '旧密码错误' });
    }

    const hashedPwd = bcrypt.hashSync(newPassword, 10);
    await pool.execute(
      `UPDATE sys_user SET password = ? WHERE id = ?`,
      [hashedPwd, req.user.id]
    );

    // 修改密码后撤销该用户所有 refresh token，强制重新登录
    await pool.execute('DELETE FROM sys_refresh_token WHERE user_id = ?', [req.user.id]);

    writeOperLog({
      userId: req.user.id, username: req.user.username, role: req.user.role,
      operation: 'change_pwd', module: 'auth',
      method: 'POST', requestUrl: '/api/auth/password',
      resultCode: 0, resultMsg: '密码修改成功',
      costTime: Date.now() - startTime
    });

    res.json({ code: 0, msg: '密码修改成功，请重新登录' });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
