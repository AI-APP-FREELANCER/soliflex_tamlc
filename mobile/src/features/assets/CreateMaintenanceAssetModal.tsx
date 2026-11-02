import { useState } from "react";
import { View } from "react-native";
import { useQuery } from "@tanstack/react-query";
import { Modal } from "@/components/Modal";
import { TextField } from "@/components/TextField";
import { CategoryField } from "@/components/CategoryField";
import { SelectField } from "@/components/SelectField";
import { DateField } from "@/components/DateField";
import { Button } from "@/components/Button";
import { useAssetCategories, useAssetMutations } from "@/features/assets/hooks";
import { fetchPlants } from "@/api/plants";

const DEFAULT_SUGGESTIONS = ["PRODUCTION_MACHINE", "PLANT_EQUIPMENT", "PERIPHERAL_ATTACHMENT", "PHYSICAL_TOOL"];

interface CreateMaintenanceAssetModalProps {
  visible: boolean;
  onClose: () => void;
  onCreated?: (id: string) => void;
}

export function CreateMaintenanceAssetModal({ visible, onClose, onCreated }: CreateMaintenanceAssetModalProps) {
  const { data: existingCategories } = useAssetCategories("maintenance");
  const { createMaintenance } = useAssetMutations();
  const { data: plants = [] } = useQuery({ queryKey: ["plants"], queryFn: fetchPlants, enabled: visible });
  const plantOptions = [{ value: "", label: "Plant location (optional)" }, ...plants.map((p) => ({ value: p.name, label: p.name }))];

  const [name, setName] = useState("");
  const [category, setCategory] = useState("PRODUCTION_MACHINE");
  const [model, setModel] = useState("");
  const [manufacturer, setManufacturer] = useState("");
  const [plantLocation, setPlantLocation] = useState("");
  const [powerCapacity, setPowerCapacity] = useState("");
  const [specifications, setSpecifications] = useState("");
  const [purchaseDate, setPurchaseDate] = useState<Date | undefined>();
  const [warrantyStartDate, setWarrantyStartDate] = useState<Date | undefined>();
  const [warrantyEndDate, setWarrantyEndDate] = useState<Date | undefined>();

  function reset() {
    setName("");
    setCategory("PRODUCTION_MACHINE");
    setModel("");
    setManufacturer("");
    setPlantLocation("");
    setPowerCapacity("");
    setSpecifications("");
    setPurchaseDate(undefined);
    setWarrantyStartDate(undefined);
    setWarrantyEndDate(undefined);
  }

  function handleSubmit() {
    createMaintenance.mutate(
      {
        name: name.trim(),
        category,
        model: model.trim() || undefined,
        manufacturer: manufacturer.trim() || undefined,
        plantLocation: plantLocation.trim() || undefined,
        powerCapacity: powerCapacity.trim() || undefined,
        specifications: specifications.trim() || undefined,
        purchaseDate: purchaseDate?.toISOString(),
        warrantyStartDate: warrantyStartDate?.toISOString(),
        warrantyEndDate: warrantyEndDate?.toISOString(),
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
    <Modal visible={visible} title="Add maintenance asset" onClose={onClose}>
      <View className="gap-4 pb-4">
        <TextField label="Name" value={name} onChangeText={setName} placeholder="e.g. CNC Lathe #3" />
        <CategoryField value={category} onChange={setCategory} suggestions={[...DEFAULT_SUGGESTIONS, ...(existingCategories ?? [])]} />
        <TextField label="Model (optional)" value={model} onChangeText={setModel} />
        <TextField label="Manufacturer (optional)" value={manufacturer} onChangeText={setManufacturer} />
        <SelectField label="Plant location (optional)" value={plantLocation} options={plantOptions} onChange={setPlantLocation} />
        <TextField label="Power capacity (optional)" value={powerCapacity} onChangeText={setPowerCapacity} placeholder="e.g. 15 kW" />
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
        <DateField label="Warranty start (optional)" value={warrantyStartDate} onChange={setWarrantyStartDate} />
        <DateField label="Warranty end (optional)" value={warrantyEndDate} onChange={setWarrantyEndDate} />
        <Button title="Create" onPress={handleSubmit} disabled={!name.trim()} loading={createMaintenance.isPending} />
      </View>
    </Modal>
  );
}
