import { useState } from "react";
import { Alert, Image, Linking, Pressable, Text, View } from "react-native";
import * as ImagePicker from "expo-image-picker";
import { FileText } from "lucide-react-native";
import { SelectField } from "@/components/SelectField";
import { Button } from "@/components/Button";
import { API_BASE_URL } from "@/lib/env";
import { ATTACHMENT_TYPE_LABELS } from "@/features/tickets/badges";
import { useTicketMutations } from "@/features/tickets/hooks";
import type { AttachmentType, Ticket } from "@/lib/types";

const TYPE_OPTIONS = (Object.keys(ATTACHMENT_TYPE_LABELS) as AttachmentType[]).map((value) => ({
  value,
  label: ATTACHMENT_TYPE_LABELS[value],
}));

interface AttachmentSectionProps {
  ticket: Ticket;
}

export function AttachmentSection({ ticket }: AttachmentSectionProps) {
  const [type, setType] = useState<AttachmentType>("PRE_FIX_PHOTO");
  const { uploadAttachment } = useTicketMutations(ticket.id);

  async function pickAndUpload(source: "camera" | "library") {
    const permission =
      source === "camera" ? await ImagePicker.requestCameraPermissionsAsync() : await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      Alert.alert("Permission needed", `Please allow ${source === "camera" ? "camera" : "photo library"} access to attach a photo.`);
      return;
    }
    const result =
      source === "camera"
        ? await ImagePicker.launchCameraAsync({ quality: 0.7 })
        : await ImagePicker.launchImageLibraryAsync({ quality: 0.7 });
    if (result.canceled || !result.assets?.[0]) return;
    const asset = result.assets[0];
    uploadAttachment.mutate({
      id: ticket.id,
      uri: asset.uri,
      fileName: asset.fileName ?? `photo-${Date.now()}.jpg`,
      mimeType: asset.mimeType ?? "image/jpeg",
      type,
    });
  }

  return (
    <View>
      <Text className="mb-2 text-sm font-semibold text-soliflex-ink">Attachments</Text>
      <View className="gap-2">
        <SelectField label="Type for next upload" value={type} options={TYPE_OPTIONS} onChange={setType} />
        <View className="flex-row gap-2">
          <View className="flex-1">
            <Button title="Take photo" variant="secondary" onPress={() => pickAndUpload("camera")} loading={uploadAttachment.isPending} />
          </View>
          <View className="flex-1">
            <Button title="Choose photo" variant="outline" onPress={() => pickAndUpload("library")} loading={uploadAttachment.isPending} />
          </View>
        </View>
      </View>

      {!!ticket.attachments?.length && (
        <View className="mt-3 flex-row flex-wrap gap-2">
          {ticket.attachments.map((a) => {
            const isImage = /\.(jpe?g|png|webp|heic)$/i.test(a.fileUrl);
            const url = `${API_BASE_URL}${a.fileUrl}`;
            return (
              <Pressable key={a.id} onPress={() => Linking.openURL(url)} className="items-center">
                {isImage ? (
                  <Image source={{ uri: url }} style={{ width: 72, height: 72, borderRadius: 8 }} />
                ) : (
                  <View className="h-[72px] w-[72px] items-center justify-center rounded-lg bg-soliflex-gray-100">
                    <FileText color="#9A9DA6" size={24} />
                  </View>
                )}
                <Text className="mt-1 w-[72px] text-center text-[10px] text-soliflex-gray-500" numberOfLines={1}>
                  {ATTACHMENT_TYPE_LABELS[a.type]}
                </Text>
              </Pressable>
            );
          })}
        </View>
      )}
    </View>
  );
}
