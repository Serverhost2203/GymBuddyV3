import { Eye, EyeSlash } from "phosphor-react-native";
import { useState } from "react";
import { Pressable, StyleProp, TextInput, TextStyle, View, ViewStyle } from "react-native";

import { makeStyles, spacing, useTheme } from "@/src/theme";

type Props = {
  value: string;
  onChangeText: (v: string) => void;
  placeholder?: string;
  testID?: string;
  autoFocus?: boolean;
  style?: StyleProp<TextStyle>;
  containerStyle?: StyleProp<ViewStyle>;
};

export function PasswordInput({ value, onChangeText, placeholder, testID, autoFocus, style, containerStyle }: Props) {
  const { colors } = useTheme();
  const s = useStyles();
  const [visible, setVisible] = useState(false);
  return (
    <View style={[s.wrap, containerStyle]}>
      <TextInput
        testID={testID}
        style={[s.input, style]}
        value={value}
        onChangeText={onChangeText}
        secureTextEntry={!visible}
        autoCapitalize="none"
        autoCorrect={false}
        autoFocus={autoFocus}
        placeholder={placeholder}
        placeholderTextColor={colors.muted}
      />
      <Pressable style={s.eye} onPress={() => setVisible((v) => !v)} hitSlop={10} testID={testID ? `${testID}-toggle` : "password-toggle"}>
        {visible ? <EyeSlash color={colors.muted} size={22} /> : <Eye color={colors.muted} size={22} />}
      </Pressable>
    </View>
  );
}

const useStyles = makeStyles(() => ({
  wrap: { position: "relative", justifyContent: "center" },
  input: { paddingRight: 48 },
  eye: { position: "absolute", right: spacing.md, height: "100%", justifyContent: "center" },
}));
