import { useState } from 'react';
import { FlatList, Pressable, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Button } from '@/components/Button';
import { CategoryIcon } from '@/components/CategoryIcon';
import { ConfirmDialog } from '@/components/ConfirmDialog';
import { ErrorState } from '@/components/ErrorState';
import { Fab } from '@/components/Fab';
import { Icon } from '@/components/Icon';
import { ListRow } from '@/components/ListRow';
import { SegmentedControl } from '@/components/SegmentedControl';
import { Skeleton } from '@/components/Skeleton';
import { useToast } from '@/components/Toast';
import { strings } from '@/content/strings';
import { categoryRepository } from '@/db/repositories/categoryRepository';
import type { Category, TxnType } from '@/db/types';
import { CategoryFormSheet } from '@/features/categories/components/CategoryFormSheet';
import { useDb } from '@/hooks/DatabaseContext';
import { useDbQuery } from '@/hooks/useDbQuery';
import { systemClock } from '@/lib/clock';
import { categoryService } from '@/services/categoryService';
import { useTheme } from '@/theme/ThemeProvider';

type CategoryWithUsage = Category & { transactionCount: number; hasBudget: boolean };

const TYPE_OPTIONS = [
  { value: 'expense', label: strings.txnType.expense },
  { value: 'income', label: strings.txnType.income },
] as const;

function IconButton({
  icon,
  label,
  onPress,
  disabled,
}: {
  icon: string;
  label: string;
  onPress: () => void;
  disabled?: boolean;
}) {
  const { colors } = useTheme();
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled }}
      style={[styles.iconButton, { opacity: disabled ? 0.3 : 1 }]}
    >
      <Icon name={icon} size={22} color={colors.textMuted} />
    </Pressable>
  );
}

export function CategoriesScreen() {
  const db = useDb();
  const toast = useToast();
  const { colors, spacing } = useTheme();
  const insets = useSafeAreaInsets();
  const [type, setType] = useState<TxnType>('expense');
  const [showArchived, setShowArchived] = useState(false);
  const [editing, setEditing] = useState<CategoryWithUsage | 'new' | null>(null);
  const [confirm, setConfirm] = useState<{
    kind: 'delete' | 'inUse';
    category: CategoryWithUsage;
  } | null>(null);
  const [busy, setBusy] = useState(false);

  const query = useDbQuery((client) => categoryRepository.listWithUsage(client, type), [type], {
    tables: ['categories', 'transactions', 'budgets'],
  });

  const run = async (work: () => Promise<unknown>, message: string) => {
    setBusy(true);
    try {
      await work();
      toast(message);
    } catch {
      toast(strings.common.somethingWrong);
    } finally {
      setBusy(false);
    }
  };

  const all = query.data ?? [];
  const active = all.filter((c) => c.archivedAt === null);
  const archived = all.filter((c) => c.archivedAt !== null);

  const requestDelete = (category: CategoryWithUsage) => {
    setEditing(null);
    setConfirm({ kind: category.transactionCount > 0 ? 'inUse' : 'delete', category });
  };

  const renderRow = (category: CategoryWithUsage, index: number, list: CategoryWithUsage[]) => (
    <ListRow
      title={category.name}
      subtitle={
        category.isSystem
          ? strings.categories.systemNote
          : strings.categories.entries(category.transactionCount)
      }
      left={<CategoryIcon icon={category.icon} color={category.color} />}
      onPress={() => setEditing(category)}
      accessibilityLabel={`${category.name}, ${strings.categories.entries(category.transactionCount)}`}
      right={
        category.archivedAt === null ? (
          <View style={styles.row}>
            <IconButton
              icon="arrow_upward"
              label={`${strings.categories.moveUp} ${category.name}`}
              disabled={index === 0}
              onPress={() => categoryService.move(db, systemClock, category.id, 'up')}
            />
            <IconButton
              icon="arrow_downward"
              label={`${strings.categories.moveDown} ${category.name}`}
              disabled={index === list.length - 1}
              onPress={() => categoryService.move(db, systemClock, category.id, 'down')}
            />
          </View>
        ) : (
          <Button
            label={strings.categories.unarchive}
            variant="ghost"
            onPress={() =>
              run(
                () => categoryService.setArchived(db, systemClock, category.id, false),
                strings.categories.saved,
              )
            }
          />
        )
      }
    />
  );

  const editingCategory = editing !== null && editing !== 'new' ? editing : null;

  return (
    <View style={[styles.fill, { backgroundColor: colors.bg }]}>
      <View style={{ padding: spacing.md }}>
        <SegmentedControl
          options={TYPE_OPTIONS}
          value={type}
          onChange={setType}
          accessibilityLabel={strings.txn.type}
        />
      </View>
      {query.status === 'loading' ? (
        <View style={{ padding: spacing.md, gap: spacing.md }}>
          {[0, 1, 2, 3].map((i) => (
            <Skeleton key={i} height={40} />
          ))}
        </View>
      ) : query.status === 'error' ? (
        <ErrorState
          title={strings.common.loadFailed}
          message={strings.common.somethingWrong}
          onRetry={query.reload}
        />
      ) : (
        <FlatList
          data={active}
          keyExtractor={(c) => c.id}
          contentContainerStyle={{
            paddingHorizontal: spacing.md,
            paddingBottom: 96 + insets.bottom,
          }}
          renderItem={({ item, index }) => renderRow(item, index, active)}
          ListFooterComponent={
            archived.length ? (
              <View style={{ marginTop: spacing.md }}>
                <Button
                  variant="ghost"
                  label={
                    showArchived
                      ? strings.categories.hideArchived
                      : strings.categories.showArchived(archived.length)
                  }
                  onPress={() => setShowArchived((s) => !s)}
                />
                {showArchived
                  ? archived.map((c, i) => <View key={c.id}>{renderRow(c, i, archived)}</View>)
                  : null}
              </View>
            ) : undefined
          }
        />
      )}
      <Fab
        accessibilityLabel={strings.categories.add}
        onPress={() => setEditing('new')}
        aboveSystemBar
      />

      <CategoryFormSheet
        visible={editing !== null}
        title={editing === 'new' ? strings.categories.newTitle : strings.categories.editTitle}
        initial={editingCategory ?? undefined}
        nameLocked={editingCategory?.isSystem}
        onClose={() => setEditing(null)}
        onSubmit={async (values) => {
          if (editingCategory) {
            await categoryService.update(db, systemClock, editingCategory.id, values);
          } else {
            await categoryService.create(db, systemClock, { ...values, type });
          }
          setEditing(null);
          toast(strings.categories.saved);
        }}
        extraActions={
          editingCategory && !editingCategory.isSystem ? (
            <View style={{ gap: spacing.sm }}>
              {editingCategory.archivedAt === null ? (
                <Button
                  label={strings.categories.archive}
                  variant="secondary"
                  onPress={() => {
                    const id = editingCategory.id;
                    setEditing(null);
                    run(
                      () => categoryService.setArchived(db, systemClock, id, true),
                      strings.categories.archivedToast,
                    );
                  }}
                />
              ) : null}
              <Button
                label={strings.common.delete}
                variant="danger"
                onPress={() => requestDelete(editingCategory)}
              />
            </View>
          ) : null
        }
      />

      <ConfirmDialog
        visible={confirm?.kind === 'delete'}
        title={confirm ? strings.categories.deleteTitle(confirm.category.name) : ''}
        body={confirm ? strings.categories.deleteBody(confirm.category.hasBudget) : ''}
        confirmLabel={strings.common.delete}
        danger
        busy={busy}
        onCancel={() => setConfirm(null)}
        onConfirm={() => {
          const id = confirm?.category.id;
          setConfirm(null);
          if (id)
            run(() => categoryService.delete(db, systemClock, id), strings.categories.deletedToast);
        }}
      />
      <ConfirmDialog
        visible={confirm?.kind === 'inUse'}
        title={confirm ? strings.categories.inUseTitle(confirm.category.name) : ''}
        body={confirm ? strings.categories.inUseBody(confirm.category.transactionCount) : ''}
        confirmLabel={strings.categories.archive}
        busy={busy}
        onCancel={() => setConfirm(null)}
        onConfirm={() => {
          const id = confirm?.category.id;
          setConfirm(null);
          if (id)
            run(
              () => categoryService.setArchived(db, systemClock, id, true),
              strings.categories.archivedToast,
            );
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  row: { flexDirection: 'row' },
  iconButton: { width: 44, height: 48, alignItems: 'center', justifyContent: 'center' },
});
