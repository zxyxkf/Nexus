/**
 * JWT鉴权中间件 - 前后端双重权限校验
 * 解析Token、校验角色权限、防止越权
 */

const crypto = require('crypto');
const jwt = require('jsonwebtoken');
const { JWT_SECRET, JWT_ACCESS_EXPIRES_IN, JWT_REFRESH_EXPIRES_IN } = require('../config/env');

/**
 * 签发短寿命 access token
 */
function generateAccessToken(payload) {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: JWT_ACCESS_EXPIRES_IN });
}

/**
 * 签发长寿命 refresh token（纯随机串，不编码用户信息）
 */
function generateRefreshToken() {
  return crypto.randomBytes(48).toString('hex');
}

/**
 * 签发 JWT Token（兼容旧调用，内部转调 generateAccessToken）
 */
function generateToken(payload) {
  return generateAccessToken(payload);
}

/**
 * 验证JWT Token
 */
function verifyToken(token) {
  try {
    return jwt.verify(token, JWT_SECRET);
  } catch (err) {
    return null;
  }
}

/**
 * 必须登录 - 从请求头解析Token并挂载到req.user
 */
function requireAuth(req, res, next) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ code: 401, msg: '未登录或Token已过期，请重新登录' });
  }

  const token = authHeader.split(' ')[1];
  const decoded = verifyToken(token);
  if (!decoded) {
    return res.status(401).json({ code: 401, msg: 'Token无效或已过期，请重新登录' });
  }

  // 挂载用户信息到请求
  req.user = {
    id: decoded.id,
    username: decoded.username,
    role: decoded.role,
    realName: decoded.realName,
    store: decoded.store || '',
    isTeamLead: decoded.isTeamLead || 0,
    permissions: decoded.permissions || []
  };

  next();
}

/**
 * 角色权限校验工厂函数
 * @param {...string} roles - 允许的角色列表
 */
function requireRole(...roles) {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ code: 401, msg: '未登录' });
    }

    if (!roles.includes(req.user.role)) {
      // 记录越权尝试
      console.warn(`[越权警告] 用户 ${req.user.username}(${req.user.role}) 尝试访问 ${req.originalUrl}`);
      return res.status(403).json({ code: 403, msg: '权限不足，请联系管理员' });
    }

    next();
  };
}

function requirePermission(permission, ...fallbackRoles) {
  return (req, res, next) => {
    if (!req.user) return res.status(401).json({ code: 401, msg: '未登录' });
    if (req.user.role === 'admin') return next();
    if (fallbackRoles.includes(req.user.role)) return next();
    if ((req.user.permissions || []).includes(permission)) return next();
    console.warn(`[越权警告] 用户 ${req.user.username}(${req.user.role}) 缺少权限 ${permission} 访问 ${req.originalUrl}`);
    return res.status(403).json({ code: 403, msg: '权限不足，请联系管理员' });
  };
}

function requireAnyPermission(permissions = [], ...fallbackRoles) {
  return (req, res, next) => {
    if (!req.user) return res.status(401).json({ code: 401, msg: '未登录' });
    if (req.user.role === 'admin') return next();
    if (fallbackRoles.includes(req.user.role)) return next();
    const owned = req.user.permissions || [];
    if (permissions.some(p => owned.includes(p))) return next();
    console.warn(`[越权警告] 用户 ${req.user.username}(${req.user.role}) 缺少任一权限 ${permissions.join(',')} 访问 ${req.originalUrl}`);
    return res.status(403).json({ code: 403, msg: '权限不足，请联系管理员' });
  };
}

/**
 * 数据归属校验 - 确保用户只能操作自己的数据
 * @param {Function} getOwnerIdFn - 从请求中获取数据归属用户ID的函数
 */
function checkDataOwnership(getOwnerIdFn) {
  return async (req, res, next) => {
    try {
      // admin / sub_admin 可以操作所有数据
      if (req.user.role === 'admin' || req.user.role === 'sub_admin') {
        return next();
      }

      const ownerId = await getOwnerIdFn(req);
      if (ownerId !== null && Number(ownerId) !== Number(req.user.id)) {
        return res.status(403).json({ code: 403, msg: '无权操作他人数据' });
      }

      next();
    } catch (err) {
      next(err);
    }
  };
}

/**
 * 灵活鉴权：优先从 Authorization 头解析，fallback 到 URL 参数 ?token=
 * 用于图片 src / window.open 等浏览器原生请求（无法自定义 Header）
 */
function optionalAuth(req, res, next) {
  // 先尝试标准 Authorization 头
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    const decoded = verifyToken(authHeader.split(' ')[1]);
    if (decoded) {
      req.user = {
        id: decoded.id,
        username: decoded.username,
        role: decoded.role,
        realName: decoded.realName,
        store: decoded.store || '',
        isTeamLead: decoded.isTeamLead || 0,
        permissions: decoded.permissions || []
      };
      return next();
    }
  }

  // fallback：从 URL 查询参数读取 token
  const token = req.query.token;
  if (token) {
    const decoded = verifyToken(token);
    if (decoded) {
      req.user = {
        id: decoded.id,
        username: decoded.username,
        role: decoded.role,
        realName: decoded.realName,
        store: decoded.store || '',
        isTeamLead: decoded.isTeamLead || 0,
        permissions: decoded.permissions || []
      };
      return next();
    }
  }

  return res.status(401).json({ code: 401, msg: '未登录或Token已过期，请重新登录' });
}

module.exports = {
  generateToken,
  generateAccessToken,
  generateRefreshToken,
  verifyToken,
  requireAuth,
  optionalAuth,
  requireRole,
  requirePermission,
  requireAnyPermission,
  requireAdmin: (...args) => requireRole('admin', ...args),
  checkDataOwnership
};
