function isEffectImage(file) {
  return file?.file_category === 'work' && file?.file_type === 'image';
}

function hasRejectIndex(file) {
  return file?.reject_index !== null
    && file?.reject_index !== undefined
    && file?.reject_index !== '';
}

function compareFiles(left, right) {
  const leftTime = new Date(left.create_time).getTime();
  const rightTime = new Date(right.create_time).getTime();
  if (Number.isFinite(leftTime) && Number.isFinite(rightTime) && leftTime !== rightTime) {
    return leftTime - rightTime;
  }

  const timeComparison = String(left.create_time || '').localeCompare(String(right.create_time || ''));
  if (timeComparison !== 0) return timeComparison;

  const leftId = Number(left.id);
  const rightId = Number(right.id);
  if (Number.isFinite(leftId) && Number.isFinite(rightId)) return leftId - rightId;
  return String(left.id || '').localeCompare(String(right.id || ''));
}

function getRoundKey(file) {
  const taskKey = String(file.task_id ?? '');
  const rejectRecordId = file?.reject_record_id;
  const roundKey = rejectRecordId !== null && rejectRecordId !== undefined && rejectRecordId !== ''
    ? `record:${rejectRecordId}`
    : (hasRejectIndex(file) ? `reject:${file.reject_index}` : 'initial');
  return `${taskKey}:${roundKey}`;
}

function decorateTaskFilesWithWatermarkLabels(files = []) {
  const result = files.map(file => ({ ...file }));
  const filesByRound = new Map();

  result.forEach(file => {
    if (!isEffectImage(file)) return;
    const key = getRoundKey(file);
    if (!filesByRound.has(key)) filesByRound.set(key, []);
    filesByRound.get(key).push(file);
  });

  filesByRound.forEach(roundFiles => {
    roundFiles.sort(compareFiles).forEach((file, index) => {
      const roundLabel = hasRejectIndex(file) ? String(file.reject_index) : '首次';
      file.drag_watermark_label = `${roundLabel}.${index + 1}`;
    });
  });

  return result;
}

module.exports = {
  decorateTaskFilesWithWatermarkLabels
};
