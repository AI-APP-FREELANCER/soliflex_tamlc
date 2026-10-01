import { useState } from "react";
import { View } from "react-native";
import { Modal } from "@/components/Modal";
import { TextField } from "@/components/TextField";
import { CategoryField } from "@/components/CategoryField";
import { DateField } from "@/components/DateField";
import { Button } from "@/components/Button";
import { useAssetCategories, useAssetMutations } from "@/features/assets/hooks";

const DEFAULT_SUGGESTIONS = ["WORKSTATION", "LAPTOP", "NETWORK_GEAR", "SERVER", "SOFTWARE_LICENSE", "SECURITY", "STORAGE"];

interface CreateITAssetModalProps {
  visible: boolean;
  onClose: () => void;
  onCreated?: (id: string) => void;
}

export function CreateITAssetModal({ visible, onClose, onCreated }: CreateITAssetModalProps) {
  const { data: existingCategories } = useAssetCategories("it");
  const { createIT } = useAssetMutations();

  const [name, setName] = useState("");
  const [category, setCategory] = useState("LAPTOP");
  const [serialNumber, setSerialNumber] = useState("");
  const [vendor, setVendor] = useState("");
  const [ipAddress, setIpAddress] = useState("");
  const [macAddress, setMacAddress] = useState("");
  const [costCenter, setCostCenter] = useState("");
  const [specifications, setSpecifications] = useState("");
  const [purchaseDate, setPurchaseDate] = useState<Date | undefined>();
  const [warrantyEndDate, setWarrantyEndDate] = useState<Date | undefined>();
  const [licenseExpiryDate, setLicenseExpiryDate] = useState<Date | undefined>();

  function reset() {
    setName("");
    setCategory("LAPTOP");
    setSerialNumber("");
    setVendor("");
    setIpAddress("");
    setMacAddress("");
    setCostCenter("");
    setSpecifications("");
    setPurchaseDate(undefined);
    setWarrantyEndDate(undefined);
    setLicenseExpiryDate(undefined);
  }

  function handleSubmit() {
    createIT.mutate(
      {
        name: name.trim(),
        category,
        serialNumber: serialNumber.trim() || undefined,
        vendor: vendor.trim() || undefined,
        ipAddress: ipAddress.trim() || undefined,
        macAddress: macAddress.trim() || undefined,
        costCenter: costCenter.trim() || undefined,
        specifications: specifications.trim() || undefined,
        purchaseDate: purchaseDate?.toISOString(),
        warrantyEndDate: warrantyEndDate?.toISOString(),
        licenseExpiryDate: licenseExpiryDate?.toISOString(),
      },
      {
        onSuccess: (asset) => {
          reset();
          onClose();
          onCreated?.(asset.id);
        },
      }
    );
  }

  return (
    <Modal visible={visible} title="Add IT asset" onClose={onClose}>
      <View className="gap-4 pb-4">
        <TextField label="Name" value={name} onChangeText={setName} placeholder="e.g. Dell Latitude 5420" />
        <CategoryField value={category} onChange={setCategory} suggestions={[...DEFAULT_SUGGESTIONS, ...(existingCategories ?? [])]} />
        <TextField label="Serial number (optional)" value={serialNumber} onChangeText={setSerialNumber} />
        <TextField label="Vendor (optional)" value={vendor} onChangeText={setVendor} />
        <TextField label="IP address (optional)" value={ipAddress} onChangeText={setIpAddress} />
        <TextField label="MAC address (optional)" value={macAddress} onChangeText={setMacAddress} />
        <TextField label="Cost center (optional)" value={costCenter} onChangeText={setCostCenter} />
        <TextField
          label="Specifications (optional)"
          value={specifications}
          onChangeText={setSpecifications}
          multiline
          numberOfLines={3}
          textAlignVertical="top"
          style={{ minHeight: 72 }}
        />
        <DateField label="Purchase date (optional)" value={purchaseDate} onChange={setPurchaseDate} />
        <DateField label="Warranty end (optional)" value={warrantyEndDate} onChange={setWarrantyEndDate} />
        <DateField label="License expiry (optional)" value={licenseExpiryDate} onChange={setLicenseExpiryDate} />
        <Button title="Create" onPress={handleSubmit} disabled={!name.trim()} loading={createIT.isPending} />
      </View>
    </Modal>
  );
}
