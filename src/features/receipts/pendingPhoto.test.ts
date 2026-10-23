import { pendingPhoto } from '@/features/receipts/pendingPhoto';
import type { Picker, PickResult } from '@/platform/picker';

const photo: PickResult = {
  status: 'picked',
  assets: [{ uri: 'file:///cache/photo.jpg', width: 3000, height: 4000 }],
};

function fakePicker(pending: PickResult | null): Picker & { calls: number } {
  const picker = {
    calls: 0,
    takePhoto: () => Promise.resolve<PickResult>({ status: 'canceled' }),
    chooseFromGallery: () => Promise.resolve<PickResult>({ status: 'canceled' }),
    pendingResult: () => {
      picker.calls += 1;
      return Promise.resolve(pending);
    },
  };
  return picker;
}

beforeEach(() => pendingPhoto.reset());

test('a recovered photo is handed to the form exactly once', async () => {
  expect(await pendingPhoto.recover(fakePicker(photo))).toBe(true);
  expect(pendingPhoto.take()).toEqual(photo);
  expect(pendingPhoto.take()).toBeNull();
});

test('nothing to recover, or the camera was cancelled', async () => {
  expect(await pendingPhoto.recover(fakePicker(null))).toBe(false);
  pendingPhoto.reset();
  expect(await pendingPhoto.recover(fakePicker({ status: 'canceled' }))).toBe(false);
  expect(pendingPhoto.take()).toBeNull();
});

test('checks only once per app start', async () => {
  const picker = fakePicker(photo);
  await pendingPhoto.recover(picker);
  expect(await pendingPhoto.recover(picker)).toBe(false);
  expect(picker.calls).toBe(1);
});
