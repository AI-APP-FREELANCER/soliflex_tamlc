import { useState } from "react";
import { Modal as RNModal, Pressable, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { CameraView, useCameraPermissions } from "expo-camera";
import { X } from "lucide-react-native";

interface QrScannerModalProps {
  visible: boolean;
  onClose: () => void;
  onDetected: (data: string) => void;
}

/** RN equivalent of the web app's html5-qrcode-based QrScannerModal — same
 * "scan fills a search box with the decoded itemCode" contract. */
export function QrScannerModal({ visible, onClose, onDetected }: QrScannerModalProps) {
  const [permission, requestPermission] = useCameraPermissions();
  const [scanned, setScanned] = useState(false);

  if (!visible) return null;

  function handleScan({ data }: { data: string }) {
    if (scanned) return;
    setScanned(true);
    onDetected(data);
    onClose();
    setTimeout(() => setScanned(false), 500);
  }

  return (
    <RNModal visible={visible} animationType="slide" onRequestClose={onClose}>
      <SafeAreaView className="flex-1 bg-black">
        <View className="flex-row items-center justify-between px-4 py-3">
          <Text className="text-base font-bold text-white">Scan asset QR code</Text>
          <Pressable onPress={onClose} hitSlop={12}>
            <X color="#fff" size={22} />
          </Pressable>
        </View>
        {!permission?.granted ? (
          <View className="flex-1 items-center justify-center gap-3 px-8">
            <Text className="text-center text-sm text-white">Camera access is needed to scan a QR code.</Text>
            <Pressable onPress={requestPermission} className="rounded-lg bg-soliflex-orange-500 px-4 py-2">
              <Text className="text-sm font-semibold text-white">Grant access</Text>
            </Pressable>
          </View>
        ) : (
          <CameraView
            style={{ flex: 1 }}
            facing="back"
            barcodeScannerSettings={{ barcodeTypes: ["qr"] }}
            onBarcodeScanned={scanned ? undefined : handleScan}
          />
        )}
      </SafeAreaView>
    </RNModal>
  );
}
