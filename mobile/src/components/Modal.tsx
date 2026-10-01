import { ReactNode } from "react";
import { Modal as RNModal, Pressable, ScrollView, Text, View } from "react-native";
import { X } from "lucide-react-native";
import { SafeAreaView } from "react-native-safe-area-context";

interface ModalProps {
  visible: boolean;
  title: string;
  onClose: () => void;
  children: ReactNode;
}

/** Full-screen-on-mobile modal sheet — stands in for the web app's centered dialog. */
export function Modal({ visible, title, onClose, children }: ModalProps) {
  return (
    <RNModal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View className="flex-1 justify-end bg-black/40">
        <SafeAreaView edges={["bottom"]} className="max-h-[88%] rounded-t-2xl bg-white">
          <View className="flex-row items-center justify-between border-b border-soliflex-gray-100 px-4 py-3">
            <Text className="text-base font-bold text-soliflex-ink">{title}</Text>
            <Pressable onPress={onClose} hitSlop={12}>
              <X color="#23272B" size={20} />
            </Pressable>
          </View>
          <ScrollView className="px-4 py-4" keyboardShouldPersistTaps="handled">
            {children}
          </ScrollView>
        </SafeAreaView>
      </View>
    </RNModal>
  );
}
