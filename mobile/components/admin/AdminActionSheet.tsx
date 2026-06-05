import React from 'react';
import {
  Modal,
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  TouchableWithoutFeedback,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Colors, FontSize, FontWeight, Radius, Spacing } from '../../constants/theme';

export interface AdminAction {
  label: string;
  onPress: () => void;
  destructive?: boolean;
}

interface AdminActionSheetProps {
  visible: boolean;
  title?: string;
  actions: AdminAction[];
  onClose: () => void;
}

export function AdminActionSheet({ visible, title, actions, onClose }: AdminActionSheetProps) {
  const insets = useSafeAreaInsets();

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
      statusBarTranslucent
    >
      <TouchableWithoutFeedback onPress={onClose}>
        <View style={styles.backdrop} />
      </TouchableWithoutFeedback>

      <View style={[styles.sheet, { paddingBottom: Math.max(insets.bottom, 16) + 8 }]}>
        {/* Drag handle */}
        <View style={styles.handle} />

        {/* Title */}
        {title ? (
          <Text style={styles.title} numberOfLines={1}>{title}</Text>
        ) : null}

        {/* Actions */}
        <View style={styles.actionsContainer}>
          {actions.map((action, i) => (
            <TouchableOpacity
              key={i}
              style={[styles.action, i < actions.length - 1 && styles.actionBorder]}
              onPress={() => { action.onPress(); onClose(); }}
              activeOpacity={0.7}
            >
              <Text style={[styles.actionText, action.destructive && styles.destructiveText]}>
                {action.label}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* Cancel */}
        <TouchableOpacity style={styles.cancelBtn} onPress={onClose} activeOpacity={0.7}>
          <Text style={styles.cancelText}>Cancel</Text>
        </TouchableOpacity>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.55)',
  },
  sheet: {
    backgroundColor: Colors.bgLayer1,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    borderTopWidth: 1,
    borderColor: Colors.glassBorder,
    paddingTop: 8,
    paddingHorizontal: Spacing.lg,
  },
  handle: {
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: Colors.glassBorder,
    alignSelf: 'center',
    marginBottom: 12,
  },
  title: {
    color: Colors.textSecondary,
    fontSize: FontSize.sm,
    fontWeight: FontWeight.medium,
    textAlign: 'center',
    paddingBottom: Spacing.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: Colors.separator,
    marginBottom: 4,
  },
  actionsContainer: {
    backgroundColor: Colors.bgLayer2,
    borderRadius: Radius.lg,
    overflow: 'hidden',
    marginVertical: Spacing.sm,
  },
  action: {
    paddingVertical: Spacing.lg,
    paddingHorizontal: Spacing.lg,
  },
  actionBorder: {
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: Colors.separator,
  },
  actionText: {
    color: Colors.textPrimary,
    fontSize: FontSize.md,
    textAlign: 'center',
  },
  destructiveText: { color: Colors.error },
  cancelBtn: {
    backgroundColor: Colors.bgLayer2,
    borderRadius: Radius.lg,
    paddingVertical: Spacing.lg,
    marginTop: 4,
  },
  cancelText: {
    color: Colors.textSecondary,
    fontSize: FontSize.md,
    fontWeight: FontWeight.semibold,
    textAlign: 'center',
  },
});
