const { inferColor } = require('../../utils/material-colors');

describe('material color inference', () => {
  test.each([
    ['军绿色A.jpg', '军绿色'],
    ['樱花粉.png', '樱花粉'],
    ['宝石蓝A.png', '宝石蓝'],
    ['卡其A.jpg', '卡其'],
    ['白色薄款两件套.jpg', '白色'],
    ['白色拼秋香绿.jpg', '白色拼秋香绿'],
    ['藏蓝拼酒红.jpg', '藏蓝拼酒红']
  ])('recognizes a color in %s', (filename, expected) => {
    expect(inferColor(filename)).toBe(expected);
  });

  test.each([
    '图片.png',
    '图片蓝色A.jpg',
    '照片1.jpg',
    '商品图A.png',
    'image.png'
  ])('does not treat a generic image name as a color: %s', filename => {
    expect(inferColor(filename)).toBe('');
  });
});
