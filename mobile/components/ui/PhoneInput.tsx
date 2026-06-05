import React, { useState } from 'react';
import { View, Text, TextInput, StyleSheet } from 'react-native';
import { Colors, FontSize, FontWeight, Spacing, Radius } from '../../constants/theme';

interface PhoneInputProps {
  /** Called with the full E.164 number: "+91XXXXXXXXXX" */
  onChangeText: (fullPhone: string) => void;
  error?: string;
  label?: string;
}

export default function PhoneInput({ onChangeText, error, label = 'Phone Number' }: PhoneInputProps) {
  const [digits, setDigits]   = useState('');
  const [focused, setFocused] = useState(false);

  function handleDigits(text: string) {
    const cleaned = text.replace(/\D/g, '').slice(0, 10);
    setDigits(cleaned);
    onChangeText(`+91${cleaned}`);
  }

  return (
    <View style={s.wrapper}>
      {label ? <Text style={s.label}>{label}</Text> : null}

      <View style={[s.row, focused && s.rowFocused, !!error && s.rowError]}>
        {/* Fixed India code */}
        <View style={s.codeBox}>
          <Text style={s.flag}>🇮🇳</Text>
          <Text style={s.code}>+91</Text>
        </View>
        <View style={s.divider} />
        <TextInput
          style={s.input}
          value={digits}
          onChangeText={handleDigits}
          placeholder="10-digit mobile number"
          placeholderTextColor={Colors.textTertiary}
          keyboardType="phone-pad"
          maxLength={10}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
        />
      </View>

      {error ? <Text style={s.error}>{error}</Text> : null}
    </View>
  );
}

const s = StyleSheet.create({
  wrapper: { gap: 6 },
  label: {
    color: Colors.textSecondary,
    fontSize: FontSize.sm,
    fontWeight: FontWeight.medium,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.inputBg,
    borderWidth: 1,
    borderColor: Colors.glassBorder,
    borderRadius: Radius.md,
    minHeight: 52,
    elevation: 1,
  },
  rowFocused: {
    borderColor: Colors.primary,
    shadowColor: Colors.primary,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.4,
    shadowRadius: 8,
  },
  rowError:  { borderColor: Colors.error },
  codeBox: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.md,
    gap: 6,
    height: '100%',
  },
  flag:    { fontSize: 20 },
  code:    { color: Colors.textPrimary, fontSize: FontSize.md, fontWeight: FontWeight.semibold },
  divider: { width: 1, height: 28, backgroundColor: Colors.glassBorder },
  input: {
    flex: 1,
    color: Colors.textPrimary,
    fontSize: FontSize.md,
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.md,
  },
  error: { color: Colors.error, fontSize: FontSize.xs },
});
