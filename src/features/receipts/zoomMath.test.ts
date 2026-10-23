import {
  clampOffset,
  clampScale,
  fitInside,
  MAX_SCALE,
  maxOffset,
} from '@/features/receipts/zoomMath';

test('scale stays between 1× and the maximum', () => {
  expect(clampScale(0.3)).toBe(1);
  expect(clampScale(2)).toBe(2);
  expect(clampScale(50)).toBe(MAX_SCALE);
});

test('no panning while the zoomed image still fits', () => {
  expect(maxOffset(400, 1000, 2)).toBe(0);
  expect(clampOffset(120, 400, 1000, 2)).toBe(0);
});

test('panning is limited so the image edge stops at the screen edge', () => {
  // 1080 wide image at 2× is 2160 wide: it may move 540 each way.
  expect(maxOffset(1080, 1080, 2)).toBe(540);
  expect(clampOffset(800, 1080, 1080, 2)).toBe(540);
  expect(clampOffset(-800, 1080, 1080, 2)).toBe(-540);
  expect(clampOffset(100, 1080, 1080, 2)).toBe(100);
});

test('fitInside keeps the aspect ratio', () => {
  expect(fitInside({ width: 1200, height: 1600 }, { width: 1080, height: 2400 })).toEqual({
    width: 1080,
    height: 1440,
  });
  expect(fitInside({ width: 1600, height: 1200 }, { width: 1080, height: 2400 })).toEqual({
    width: 1080,
    height: 810,
  });
  expect(fitInside({ width: 0, height: 0 }, { width: 10, height: 20 })).toEqual({
    width: 10,
    height: 20,
  });
});
