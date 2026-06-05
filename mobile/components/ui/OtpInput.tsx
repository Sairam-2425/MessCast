import React, { useRef, useEffect } from 'react';
import { View, Text, TextInput, StyleSheet } from 'react-native';
import { Colors, FontSize, FontWeight, Spacing, Radius } from '../../constants/theme';

interface OtpInputProps {
  value: string;
  onChange: (val: string) => void;
  error?: string;
  autoFocus?: boolean;
}

const LEN = 6;

export default function OtpInput({ value, onChange, error, autoFocus }: OtpInputProps) {
  const refs   = useRef<(TextInput | null)[]>([]);
  const digits = value.split('').concat(Array(LEN).fill('')).slice(0, LEN);

  useEffect(() => {
    if (autoFocus) setTimeout(() => refs.current[0]?.focus(), 150);
  }, [autoFocus]);

  function handleChange(text: string, i: number) {
    // Support paste of full 6-digit code
    if (text.length === LEN && /^\d{6}$/.test(text)) {
      onChange(text);
      refs.current[LEN - 1]?.focus();
      return;
    }
    const d    = text.replace(/\D/g, '').slice(-1);
    const next = [...digits];
    next[i]    = d;
    onChange(next.join(''));
    if (d && i < LEN - 1) refs.current[i + 1]?.focus();
  }

  function handleKey(key: string, i: number) {
    if (key === 'Backspace' && !digits[i] && i > 0) {
      const next = [...digits];
      next[i - 1] = '';
      onChange(next.join(''));
      refs.current[i - 1]?.focus();
    }
  }

  return (
    <View>
      <View style={s.row}>
        {Array.from({ length: LEN }).map((_, i) => (
          <TextInput
            key={i}
            ref={(r) => { refs.current[i] = r; }}
            style={[s.box, digits[i] && s.boxFilled, !!error && s.boxError]}
            value={digits[i]}
            onChangeText={(t) => handleChange(t, i)}
            onKeyPress={({ nativeEvent }) => handleKey(nativeEvent.key, i)}
            keyboardType="number-pad"
            maxLength={LEN}
            selectTextOnFocus
            textAlign="center"
            caretHidden
          />
        ))}
      </View>
      {error ? <Text style={s.error}>{error}</Text> : null}
    </View>
  );
}

const s = StyleSheet.create({
  row: {
    flexDirection: 'row',
    gap: Spacing.sm,
    justifyContent: 'center',
  },
  box: {
    width: 48,
    height: 56,
    borderRadius: Radius.sm,
    borderWidth: 1.5,
    borderColor: Colors.glassBorder,
    backgroundColor: Colors.inputBg,
    color: Colors.textPrimary,
    fontSize: FontSize.xl,
    fontWeight: FontWeight.bold,
    // Constant elevation prevents Android from re-computing Z-order on focus/blur,
    // which would cause the TextInput to silently lose focus (keyboard dismisses).
    elevation: 1,
  },
  boxFilled: {
    borderColor: Colors.primary,
    backgroundColor: 'rgba(124,92,252,0.1)',
  },
  boxError: { borderColor: Colors.error },
  error: {
    color: Colors.error,
    fontSize: FontSize.sm,
    textAlign: 'center',
    marginTop: Spacing.sm,
  },
});
