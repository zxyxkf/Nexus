function normalizeTaskGroup(taskOrGroup) {
  const value = typeof taskOrGroup === 'string'
    ? taskOrGroup
    : taskOrGroup?.task_group;
  return value || 'design';
}

function requiresManualScore(task) {
  return normalizeTaskGroup(task) === 'design'
    && Number(task?.requires_manual_score) === 1;
}

function isManualScorePending(task) {
  return requiresManualScore(task) && task?.status !== 'finished';
}

function roundScore(value) {
  return Math.round(value * 100) / 100;
}

function scoreForStats(task, taskGroup = normalizeTaskGroup(task)) {
  if (task?.score_review_status === 'pending') return 0;
  if (taskGroup === 'design' && isManualScorePending(task)) return 0;

  const score = Number(task?.score);
  const baseScore = Number.isFinite(score) ? score : 0;
  if (taskGroup === 'design') return roundScore(baseScore);

  const quantity = Number(task?.actual_quantity);
  return roundScore(baseScore * (Number.isFinite(quantity) && quantity > 0 ? quantity : 1));
}

function parseManualReviewScore(value) {
  if (value === null || value === undefined) return null;
  if (typeof value !== 'string' && typeof value !== 'number') return null;
  const raw = String(value).trim();
  if (!/^(?:0|[1-9]\d*)(?:\.\d{1,2})?$/.test(raw)) return null;
  const score = Number(raw);
  return Number.isFinite(score) && score >= 0 ? score : null;
}

module.exports = {
  normalizeTaskGroup,
  requiresManualScore,
  isManualScorePending,
  scoreForStats,
  parseManualReviewScore
};
