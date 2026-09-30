import { Text, TextInput, TextInputProps, View } from "react-native";

interface TextFieldProps extends TextInputProps {
  label?: string;
  error?: string;
}

export function TextField({ label, error, ...inputProps }: TextFieldProps) {
  return (
    <View>
      {label && <Text className="mb-1 text-sm font-medium text-soliflex-gray-700">{label}</Text>}
      <TextInput
        placeholderTextColor="#9A9DA6"
        className="rounded-lg border border-soliflex-gray-200 px-3 py-3 text-sm text-soliflex-ink"
        {...inputProps}
      />
      {error && <Text className="mt-1 text-xs text-red-600">{error}</Text>}
    </View>
  );
}
