import { NativeTabs } from 'expo-router/native-tabs';

import { strings } from '@/content/strings';
import { useTheme } from '@/theme/ThemeProvider';

// Bottom tabs: Home · Transactions · Udhaar · Reports · More (docs/06-design/SCREENS_AND_NAVIGATION.md).
// Icons are Material Symbols bundled with expo-symbols — no network.
export default function TabsLayout() {
  const { colors } = useTheme();

  return (
    <NativeTabs
      backgroundColor={colors.surface}
      indicatorColor={colors.primarySoft}
      rippleColor={colors.primarySoft}
      iconColor={{ default: colors.textMuted, selected: colors.primary }}
      labelStyle={{ default: { color: colors.textMuted }, selected: { color: colors.primary } }}
      labelVisibilityMode="labeled"
    >
      <NativeTabs.Trigger name="index">
        <NativeTabs.Trigger.Icon md="home" />
        <NativeTabs.Trigger.Label>{strings.tab.home}</NativeTabs.Trigger.Label>
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="transactions">
        <NativeTabs.Trigger.Icon md="receipt_long" />
        <NativeTabs.Trigger.Label>{strings.tab.transactions}</NativeTabs.Trigger.Label>
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="udhaar">
        <NativeTabs.Trigger.Icon md="handshake" />
        <NativeTabs.Trigger.Label>{strings.tab.udhaar}</NativeTabs.Trigger.Label>
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="reports">
        <NativeTabs.Trigger.Icon md="bar_chart" />
        <NativeTabs.Trigger.Label>{strings.tab.reports}</NativeTabs.Trigger.Label>
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="more">
        <NativeTabs.Trigger.Icon md="more_horiz" />
        <NativeTabs.Trigger.Label>{strings.tab.more}</NativeTabs.Trigger.Label>
      </NativeTabs.Trigger>
    </NativeTabs>
  );
}
