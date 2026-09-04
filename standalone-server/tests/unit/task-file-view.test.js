const {
  getInitialWorkFiles,
  getEffectFiles,
  getOriginalFiles
} = require('../../services/task-file-view');

describe('任务文件展示选择器', () => {
  it('效果图优先取最新已完成修改轮次并独立保留原图', () => {
    const files = [
      { id: 1, file_category: 'work', file_type: 'image', reject_record_id: null },
      { id: 2, file_category: 'work', file_type: 'image', reject_record_id: 3, reject_index: 3 },
      { id: 3, file_category: 'work', file_type: 'image', reject_record_id: 2, reject_index: 2 },
      { id: 4, file_category: 'original', file_type: 'attachment' }
    ];

    expect(getInitialWorkFiles(files).map(file => file.id)).toEqual([1]);
    expect(getEffectFiles(files).map(file => file.id)).toEqual([2]);
    expect(getOriginalFiles(files).map(file => file.id)).toEqual([4]);
  });

  it('没有修改作品时效果图回退到首次作品', () => {
    const files = [{ id: 1, file_category: 'work', file_type: 'image', reject_record_id: null }];
    expect(getEffectFiles(files).map(file => file.id)).toEqual([1]);
  });
});
