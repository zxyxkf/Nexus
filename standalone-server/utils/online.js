async function isUserOnline(userId) {
  if (!userId || !global.io) return false;
  try {
    const sockets = await global.io.in(`user:${userId}`).fetchSockets();
    return sockets.length > 0;
  } catch {
    return false;
  }
}

async function attachOnlineStatus(users) {
  return Promise.all((users || []).map(async user => ({
    ...user,
    is_online: await isUserOnline(user.id)
  })));
}

module.exports = { isUserOnline, attachOnlineStatus };
