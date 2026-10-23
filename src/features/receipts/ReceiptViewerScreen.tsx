// Full-screen receipt viewer (RECEIPTS.md § Viewing, RCP-04/05/06): swipe between
// receipts, pinch and double-tap zoom, page indicator, Replace and Delete.

import { Stack, useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import {
  FlatList,
  Pressable,
  StatusBar,
  StyleSheet,
  useWindowDimensions,
  View,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { AppText } from '@/components/AppText';
import { Button } from '@/components/Button';
import { ConfirmDialog } from '@/components/ConfirmDialog';
import { Icon } from '@/components/Icon';
import { useToast } from '@/components/Toast';
import { strings } from '@/content/strings';
import { attachmentRepository } from '@/db/repositories/attachmentRepository';
import type { Attachment } from '@/db/types';
import { ZoomableImage } from '@/features/receipts/components/ZoomableImage';
import { useReceiptPicker } from '@/features/receipts/useReceiptPicker';
import { fitInside } from '@/features/receipts/zoomMath';
import { useDb } from '@/hooks/DatabaseContext';
import { useDbQuery } from '@/hooks/useDbQuery';
import { systemClock } from '@/lib/clock';
import { receipts } from '@/services/receipts';

const WHITE = '#FFFFFF';
const BLACK = '#000000';

function HeaderButton({
  icon,
  label,
  onPress,
}: {
  icon: string;
  label: string;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={label}
      hitSlop={8}
      style={styles.headerButton}
    >
      <Icon name={icon} color={WHITE} />
    </Pressable>
  );
}

export function ReceiptViewerScreen({
  transactionId,
  initialIndex,
}: {
  transactionId: string;
  initialIndex: number;
}) {
  const db = useDb();
  const router = useRouter();
  const toast = useToast();
  const window = useWindowDimensions();
  const [index, setIndex] = useState(initialIndex);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [busy, setBusy] = useState(false);
  // While a receipt is zoomed, one-finger drags pan the image instead of swiping pages.
  const [zoomed, setZoomed] = useState(false);
  const onZoomChange = useCallback((value: boolean) => setZoomed(value), []);

  const query = useDbQuery(
    (client) => attachmentRepository.listByTransaction(client, transactionId),
    [transactionId],
    { tables: ['transaction_attachments'] },
  );
  const items = query.data ?? [];
  const current: Attachment | undefined = items[Math.min(index, items.length - 1)];

  const picker = useReceiptPicker(async ([draft]) => {
    if (!draft || !current) return;
    try {
      await receipts.replace(db, systemClock, current.id, draft);
      toast(strings.receipts.replaced);
    } catch {
      toast(strings.common.somethingWrong);
    }
  });

  const remove = async (attachment: Attachment) => {
    setBusy(true);
    try {
      await receipts.remove(db, systemClock, attachment.id);
      toast(strings.receipts.deleted);
      if (items.length <= 1) router.back();
      else setIndex((i) => Math.max(0, Math.min(i, items.length - 2)));
    } catch {
      toast(strings.common.somethingWrong);
    } finally {
      setBusy(false);
      setConfirmDelete(false);
    }
  };

  const renderItem = ({ item, index: i }: { item: Attachment; index: number }) => {
    const uri = receipts.resolveUri(item.relativePath);
    if (!uri) {
      // RCP-06: missing file → placeholder with a way out, never a crash. The photo is
      // already gone, so removing the broken row needs no confirmation.
      return (
        <View style={[styles.missing, { width: window.width, height: window.height }]}>
          <Icon name="hide_image" size={48} color={WHITE} />
          <AppText style={{ color: WHITE }}>{strings.receipts.missing}</AppText>
          <Button
            label={strings.receipts.remove}
            variant="secondary"
            onPress={() => remove(item)}
            disabled={busy}
          />
        </View>
      );
    }
    const size = fitInside(item, window);
    return (
      <ZoomableImage
        uri={uri}
        width={size.width}
        height={size.height}
        containerWidth={window.width}
        containerHeight={window.height}
        onZoomChange={onZoomChange}
        accessibilityLabel={`${strings.receipts.title} ${i + 1}`}
      />
    );
  };

  const onPageChange = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    const page = Math.round(e.nativeEvent.contentOffset.x / window.width);
    if (page !== index) {
      setIndex(page);
      setZoomed(false); // the new page starts at 1×
    }
  };

  return (
    <View style={styles.fill}>
      <Stack.Screen
        options={{ headerShown: false, presentation: 'fullScreenModal', animation: 'fade' }}
      />
      <StatusBar barStyle="light-content" />
      {items.length > 0 ? (
        <FlatList
          data={items}
          keyExtractor={(item) => item.id}
          renderItem={renderItem}
          horizontal
          pagingEnabled
          scrollEnabled={!zoomed}
          showsHorizontalScrollIndicator={false}
          initialScrollIndex={Math.min(initialIndex, items.length - 1)}
          getItemLayout={(_data, i) => ({
            length: window.width,
            offset: window.width * i,
            index: i,
          })}
          onMomentumScrollEnd={onPageChange}
        />
      ) : null}
      <SafeAreaView edges={['top']} style={styles.header} pointerEvents="box-none">
        <HeaderButton icon="close" label={strings.common.close} onPress={() => router.back()} />
        <AppText style={styles.counter} accessibilityLiveRegion="polite">
          {items.length > 0
            ? strings.receipts.viewer(Math.min(index, items.length - 1) + 1, items.length)
            : ''}
        </AppText>
        {current ? (
          <View style={styles.row}>
            <HeaderButton
              icon="find_replace"
              label={strings.receipts.replace}
              onPress={() => picker.open(1)}
            />
            <HeaderButton
              icon="delete"
              label={strings.common.delete}
              onPress={() => setConfirmDelete(true)}
            />
          </View>
        ) : null}
      </SafeAreaView>
      <ConfirmDialog
        visible={confirmDelete}
        title={strings.receipts.deleteTitle}
        body={strings.receipts.deleteBody}
        confirmLabel={strings.common.delete}
        danger
        busy={busy}
        onCancel={() => setConfirmDelete(false)}
        onConfirm={() => current && remove(current)}
      />
      {picker.element}
    </View>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1, backgroundColor: BLACK },
  header: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 8,
    backgroundColor: 'rgba(0,0,0,0.4)',
  },
  headerButton: { width: 48, height: 48, alignItems: 'center', justifyContent: 'center' },
  counter: { color: WHITE, flex: 1, textAlign: 'center' },
  row: { flexDirection: 'row' },
  missing: { alignItems: 'center', justifyContent: 'center', gap: 16, padding: 24 },
});
