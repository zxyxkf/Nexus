const { fixFilenameEncoding } = require('../../utils/upload');

describe('fixFilenameEncoding', () => {
  it('preserves filenames already decoded as Unicode', () => {
    expect(fixFilenameEncoding('\u84dd\u8272A.png')).toBe('\u84dd\u8272A.png');
  });

  it('repairs legacy Latin-1 decoded UTF-8 filenames', () => {
    const mojibake = Buffer.from('\u84dd\u8272A.png', 'utf8').toString('latin1');
    expect(fixFilenameEncoding(mojibake)).toBe('\u84dd\u8272A.png');
  });
});
