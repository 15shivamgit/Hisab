// "Remind" sheet (UDHAAR.md § Remind via WhatsApp / SMS / share, UDH-09). The message is
// shown and editable before anything opens. WhatsApp/SMS links are opened by Android;
// Hisaab itself sends nothing (no SMS permission, no network).

import { useState } from 'react';
import { View } from 'react-native';

import { AppText } from '@/components/AppText';
import { Button } from '@/components/Button';
import { Sheet } from '@/components/Sheet';
import { TextField } from '@/components/TextField';
import { useToast } from '@/components/Toast';
import { strings } from '@/content/strings';
import { reminderMessage } from '@/content/templates';
import type { PersonWithBalance } from '@/db/types';
import { smsUrl, whatsappUrl } from '@/lib/phone';
import { diagnostics } from '@/services/diagnostics';
import { useTheme } from '@/theme/ThemeProvider';
import { openUrl, shareText } from '@/platform/system';

export function RemindSheet({
  person,
  visible,
  onClose,
}: {
  person: PersonWithBalance;
  visible: boolean;
  onClose: () => void;
}) {
  // Remount on open so the message starts from the template each time.
  return visible ? <RemindBody person={person} onClose={onClose} /> : null;
}

function RemindBody({ person, onClose }: { person: PersonWithBalance; onClose: () => void }) {
  const toast = useToast();
  const { spacing } = useTheme();
  const [message, setMessage] = useState(() =>
    reminderMessage({
      name: person.name,
      balancePaise: person.balancePaise,
      returnByDate: person.returnByDate,
    }),
  );

  const open = async (url: string) => {
    try {
      // No canOpenURL check: it would need <queries> entries (UDHAAR.md Verify note).
      await openUrl(url);
      onClose();
    } catch (error) {
      void diagnostics.record(error, 'remind.openUrl');
      toast(strings.remind.couldNotOpen);
    }
  };

  const share = async () => {
    try {
      await shareText(message);
      onClose();
    } catch (error) {
      void diagnostics.record(error, 'remind.share');
      toast(strings.common.somethingWrong);
    }
  };

  return (
    <Sheet visible title={strings.remind.title} onClose={onClose}>
      <View style={{ gap: spacing.md }}>
        <TextField
          label={strings.remind.message}
          value={message}
          onChangeText={setMessage}
          multiline
          style={{ minHeight: 120, textAlignVertical: 'top' }}
        />
        {person.phone ? (
          <View style={{ flexDirection: 'row', gap: spacing.sm }}>
            <View style={{ flex: 1 }}>
              <Button
                label={strings.remind.whatsapp}
                onPress={() => void open(whatsappUrl(person.phone!, message))}
              />
            </View>
            <View style={{ flex: 1 }}>
              <Button
                label={strings.remind.sms}
                variant="secondary"
                onPress={() => void open(smsUrl(person.phone!, message))}
              />
            </View>
          </View>
        ) : (
          <AppText variant="caption" color="textMuted">
            {strings.remind.noPhone}
          </AppText>
        )}
        <Button label={strings.remind.share} variant="secondary" onPress={() => void share()} />
      </View>
    </Sheet>
  );
}
