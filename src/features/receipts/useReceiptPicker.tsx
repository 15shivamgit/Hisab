// Camera/gallery → compressed drafts, with the source sheet, the camera-denied dialog,
// and error toasts (RECEIPTS.md § Sources, § Errors).

import { useState } from 'react';
import { Linking, View } from 'react-native';

import { ConfirmDialog } from '@/components/ConfirmDialog';
import { Icon } from '@/components/Icon';
import { ListRow } from '@/components/ListRow';
import { Sheet } from '@/components/Sheet';
import { useToast } from '@/components/Toast';
import { strings } from '@/content/strings';
import { pendingPhoto } from '@/features/receipts/pendingPhoto';
import { isAppError } from '@/lib/errors';
import { devicePicker, type PickResult } from '@/platform/picker';
import type { ReceiptDraft } from '@/services/receiptService';
import { receipts } from '@/services/receipts';
import { diagnostics } from '@/services/diagnostics';
import { useTheme } from '@/theme/ThemeProvider';

function errorMessage(error: unknown): string {
  const detail = isAppError(error) ? error.detail : undefined;
  const messages = strings.receipts.errors as Record<string, string>;
  return (detail && messages[detail]) || strings.receipts.errors.COMPRESS_FAILED;
}

export function useReceiptPicker(onDrafts: (drafts: ReceiptDraft[]) => void) {
  const toast = useToast();
  const { colors } = useTheme();
  const [sheetFor, setSheetFor] = useState<number | null>(null);
  const [deniedFor, setDeniedFor] = useState<number | null>(null);
  const [processing, setProcessing] = useState(0);

  const handle = async (result: PickResult, remaining: number) => {
    if (result.status === 'denied') {
      setDeniedFor(remaining);
      return;
    }
    if (result.status !== 'picked') return;
    const assets = result.assets.slice(0, remaining);
    setProcessing((p) => p + assets.length);
    const drafts: ReceiptDraft[] = [];
    for (const asset of assets) {
      try {
        drafts.push(await receipts.prepare(asset));
      } catch (error) {
        void diagnostics.record(error, 'receiptPicker');
        toast(errorMessage(error));
      } finally {
        setProcessing((p) => p - 1);
      }
    }
    if (drafts.length) onDrafts(drafts);
  };

  const run = async (pick: () => Promise<PickResult>, remaining: number) => {
    setSheetFor(null);
    try {
      await handle(await pick(), remaining);
    } catch (error) {
      void diagnostics.record(error, 'receiptPicker');
      toast(strings.common.somethingWrong);
    }
  };

  const takePhoto = (remaining: number) => run(() => devicePicker.takePhoto(), remaining);
  const fromGallery = (remaining: number) =>
    run(() => devicePicker.chooseFromGallery(remaining), remaining);

  /** Attaches a photo taken just before Android killed the app (RECEIPTS.md § Sources). */
  const recoverPending = async (remaining: number) => {
    const pending = pendingPhoto.take();
    if (pending) await handle(pending, remaining);
  };

  const element = (
    <>
      <Sheet
        visible={sheetFor !== null}
        title={strings.receipts.add}
        onClose={() => setSheetFor(null)}
      >
        <View>
          <ListRow
            title={strings.receipts.takePhoto}
            left={<Icon name="photo_camera" color={colors.primary} />}
            onPress={() => sheetFor !== null && takePhoto(sheetFor)}
            accessibilityLabel={strings.receipts.takePhoto}
          />
          <ListRow
            title={strings.receipts.chooseFromGallery}
            left={<Icon name="photo_library" color={colors.primary} />}
            onPress={() => sheetFor !== null && fromGallery(sheetFor)}
            accessibilityLabel={strings.receipts.chooseFromGallery}
          />
        </View>
      </Sheet>
      <ConfirmDialog
        visible={deniedFor !== null}
        title={strings.receipts.cameraDeniedTitle}
        body={strings.receipts.cameraDeniedBody}
        confirmLabel={strings.receipts.openSettings}
        cancelLabel={strings.receipts.useGallery}
        onConfirm={() => {
          setDeniedFor(null);
          void Linking.openSettings();
        }}
        onCancel={() => {
          const remaining = deniedFor;
          setDeniedFor(null);
          if (remaining !== null) void fromGallery(remaining);
        }}
        onDismiss={() => setDeniedFor(null)}
      />
    </>
  );

  return {
    /** Opens the "Take photo / Choose from gallery" sheet for up to `remaining` photos. */
    open: (remaining: number) => setSheetFor(remaining),
    recoverPending,
    processing,
    element,
  };
}
