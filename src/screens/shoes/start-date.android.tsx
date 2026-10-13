import DateTimePicker from '@expo/ui/community/datetime-picker';
import { useState } from 'react';
import { View } from 'react-native';

import { Press } from '@/components/press';
import { Txt } from '@/components/themed-text';
import { startOfDay } from '@/data/mileage';
import { border, colors, spacing } from '@/theme';

/** Health Connect counts from an exact date, not a rough preset. @ref LLP 0006#adding-a-pair */
export function StartDateField({ value, onChange }: { value: number; onChange: (day: number) => void }) {
  const [open, setOpen] = useState(false);
  return (
    <View>
      <Press onPress={() => setOpen(true)} accessibilityRole="button" accessibilityLabel="Choose the date you started running in this pair"
        style={{ padding: spacing.md, borderWidth: border.rule, borderColor: colors.controlBorder }}>
        <Txt variant="body">{new Date(value).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}</Txt>
      </Press>
      {open ? <DateTimePicker value={new Date(value)} maximumDate={new Date()} mode="date" accentColor={colors.blue}
        onDismiss={() => setOpen(false)} onValueChange={(_event, date) => { setOpen(false); onChange(startOfDay(date.getTime())); }} /> : null}
    </View>
  );
}
