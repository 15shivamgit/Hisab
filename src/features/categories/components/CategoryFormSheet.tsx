import { useState, type ReactNode } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { AppText } from '@/components/AppText';
import { Button } from '@/components/Button';
import { categoryColor } from '@/components/CategoryIcon';
import { Icon } from '@/components/Icon';
import { Sheet } from '@/components/Sheet';
import { TextField } from '@/components/TextField';
import { strings } from '@/content/strings';
import {
  CATEGORY_COLOR_CHOICES,
  CATEGORY_ICON_CHOICES,
  DEFAULT_NEW_CATEGORY,
} from '@/features/categories/choices';
import { isAppError } from '@/lib/errors';
import { useTheme } from '@/theme/ThemeProvider';

export interface CategoryFormValues {
  name: string;
  icon: string;
  color: string;
}

interface CategoryFormSheetProps {
  visible: boolean;
  title: string;
  initial?: CategoryFormValues;
  /** The system "Other" category keeps its name (CAT-05). */
  nameLocked?: boolean;
  onSubmit: (values: CategoryFormValues) => Promise<void>;
  onClose: () => void;
  /** Extra actions under Save (edit mode: Archive / Delete). */
  extraActions?: ReactNode;
}

export function CategoryFormSheet({
  visible,
  title,
  initial,
  nameLocked = false,
  onSubmit,
  onClose,
  extraActions,
}: CategoryFormSheetProps) {
  const { colors, radius, spacing } = useTheme();
  const [values, setValues] = useState<CategoryFormValues>({ name: '', ...DEFAULT_NEW_CATEGORY });
  const [error, setError] = useState<string>();
  const [saving, setSaving] = useState(false);
  const [wasVisible, setWasVisible] = useState(false);

  // Reset only when the sheet opens (not on every render of a new `initial` object).
  if (visible !== wasVisible) {
    setWasVisible(visible);
    if (visible) {
      setValues(initial ?? { name: '', ...DEFAULT_NEW_CATEGORY });
      setError(undefined);
    }
  }

  const submit = async () => {
    const name = values.name.trim();
    if (name.length < 1 || name.length > 30) {
      setError(strings.errors['category.name']);
      return;
    }
    setSaving(true);
    try {
      await onSubmit({ ...values, name });
    } catch (e) {
      setError(
        isAppError(e) && e.detail === 'CATEGORY_DUPLICATE'
          ? strings.errors['category.duplicate'](name)
          : strings.common.somethingWrong,
      );
    } finally {
      setSaving(false);
    }
  };

  return (
    <Sheet
      visible={visible}
      title={title}
      onClose={onClose}
      footer={
        <View style={{ gap: spacing.sm }}>
          <Button label={strings.common.save} onPress={submit} loading={saving} />
          {extraActions}
        </View>
      }
    >
      <TextField
        label={strings.categories.name}
        value={values.name}
        onChangeText={(name) => setValues((v) => ({ ...v, name }))}
        maxLength={30}
        editable={!nameLocked}
        error={error}
        autoFocus={!initial}
      />
      <AppText variant="label" color="textMuted">
        {strings.categories.icon}
      </AppText>
      <View style={[styles.grid, { gap: spacing.sm }]}>
        {CATEGORY_ICON_CHOICES.map((icon) => {
          const selected = values.icon === icon;
          return (
            <Pressable
              key={icon}
              onPress={() => setValues((v) => ({ ...v, icon }))}
              accessibilityRole="radio"
              accessibilityState={{ checked: selected }}
              accessibilityLabel={icon.replace(/_/g, ' ')}
              style={[
                styles.cell,
                {
                  borderRadius: radius.md,
                  borderColor: selected ? colors.primary : colors.border,
                  backgroundColor: selected ? colors.primarySoft : colors.surfaceAlt,
                },
              ]}
            >
              <Icon name={icon} color={categoryColor(values.color)} />
            </Pressable>
          );
        })}
      </View>
      <AppText variant="label" color="textMuted">
        {strings.categories.color}
      </AppText>
      <View style={[styles.grid, { gap: spacing.sm }]}>
        {CATEGORY_COLOR_CHOICES.map((token) => {
          const selected = values.color === token;
          return (
            <Pressable
              key={token}
              onPress={() => setValues((v) => ({ ...v, color: token }))}
              accessibilityRole="radio"
              accessibilityState={{ checked: selected }}
              accessibilityLabel={token.replace('cat.', '')}
              style={[
                styles.cell,
                {
                  borderRadius: radius.full,
                  borderColor: selected ? colors.text : 'transparent',
                  backgroundColor: categoryColor(token),
                },
              ]}
            >
              {selected ? <Icon name="check" color="#FFFFFF" /> : null}
            </Pressable>
          );
        })}
      </View>
    </Sheet>
  );
}

const styles = StyleSheet.create({
  grid: { flexDirection: 'row', flexWrap: 'wrap' },
  cell: { width: 48, height: 48, alignItems: 'center', justifyContent: 'center', borderWidth: 2 },
});
