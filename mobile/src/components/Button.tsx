import { ActivityIndicator, Pressable, Text } from "react-native";

interface ButtonProps {
  title: string;
  onPress: () => void;
  loading?: boolean;
  disabled?: boolean;
  variant?: "primary" | "secondary" | "outline";
}

export function Button({ title, onPress, loading, disabled, variant = "primary" }: ButtonProps) {
  const isDisabled = disabled || loading;

  const base = "flex-row items-center justify-center gap-2 rounded-lg px-4 py-3";
  const variants: Record<string, string> = {
    primary: "bg-soliflex-orange-500",
    secondary: "bg-soliflex-gray-100",
    outline: "border border-soliflex-gray-200 bg-white",
  };
  const textVariants: Record<string, string> = {
    primary: "text-white",
    secondary: "text-soliflex-ink",
    outline: "text-soliflex-ink",
  };

  return (
    <Pressable
      onPress={onPress}
      disabled={isDisabled}
      className={`${base} ${variants[variant]} ${isDisabled ? "opacity-50" : ""}`}
    >
      {loading && <ActivityIndicator color={variant === "primary" ? "#fff" : "#23272B"} size="small" />}
      <Text className={`text-sm font-semibold ${textVariants[variant]}`}>{title}</Text>
    </Pressable>
  );
}
