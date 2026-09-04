function normalizeFiles(files) {
  return Array.isArray(files) ? files.filter(Boolean) : [];
}

function initialWorkFiles(files) {
  return normalizeFiles(files)
    .filter(file => file.file_category === 'work' && !Number(file.reject_record_id));
}

function modificationWorkFiles(files) {
  return normalizeFiles(files)
    .filter(file => file.file_category === 'work' && Number(file.reject_record_id) > 0)
    .sort((left, right) => {
      const leftRound = Number(left.reject_index) || Number(left.reject_record_id) || 0;
      const rightRound = Number(right.reject_index) || Number(right.reject_record_id) || 0;
      return rightRound - leftRound || Number(left.id || 0) - Number(right.id || 0);
    });
}

function getInitialWorkFiles(files) {
  return initialWorkFiles(files);
}

function getEffectFiles(files) {
  const modifications = modificationWorkFiles(files);
  if (!modifications.length) return initialWorkFiles(files);
  const latestRound = Number(modifications[0].reject_index)
    || Number(modifications[0].reject_record_id)
    || 0;
  return modifications.filter(file => (
    (Number(file.reject_index) || Number(file.reject_record_id) || 0) === latestRound
  ));
}

function getOriginalFiles(files) {
  return normalizeFiles(files)
    .filter(file => file.file_category === 'original')
    .sort((left, right) => new Date(left.create_time || 0) - new Date(right.create_time || 0)
      || Number(left.id || 0) - Number(right.id || 0));
}

module.exports = { getInitialWorkFiles, getEffectFiles, getOriginalFiles };
