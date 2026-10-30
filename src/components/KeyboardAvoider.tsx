import { useRef, useState, type ReactNode } from 'react';
import {
  KeyboardAvoidingView,
  StyleSheet,
  View,
  type HostInstance,
  type StyleProp,
  type ViewStyle,
} from 'react-native';

/**
 * KeyboardAvoidingView (padding) that knows where it sits in the window. The stock
 * component compares its layout `y` (relative to its parent) with the keyboard's window
 * position, so under a native stack header it pads too little by the header height and
 * the keyboard hides the Save footer (found on Android 17 in Phase 10). Measuring our own
 * top in the window and passing it as `keyboardVerticalOffset` fixes that.
 */
export function KeyboardAvoider({
  style,
  children,
}: {
  style?: StyleProp<ViewStyle>;
  children: ReactNode;
}) {
  const ref = useRef<HostInstance>(null);
  const [top, setTop] = useState(0);
  return (
    <View
      ref={ref}
      style={styles.fill}
      onLayout={() => ref.current?.measureInWindow((_x, y) => setTop(y))}
    >
      <KeyboardAvoidingView
        behavior="padding"
        keyboardVerticalOffset={top}
        style={[styles.fill, style]}
      >
        {children}
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({ fill: { flex: 1 } });
