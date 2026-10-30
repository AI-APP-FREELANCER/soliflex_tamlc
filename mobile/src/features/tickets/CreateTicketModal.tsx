import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Text, View } from "react-native";
import { Modal } from "@/components/Modal";
import { TextField } from "@/components/TextField";
import { SelectField } from "@/components/SelectField";
import { AssetPicker } from "@/components/AssetPicker";
import { MachinePicker } from "@/components/MachinePicker";
import { Button } from "@/components/Button";
import { ISTClock } from "@/components/ISTClock";
import { useAuthStore } from "@/store/auth.store";
import { MACHINE_STATUS_LABELS, PROBLEM_TYPE_LABELS, TICKET_CATEGORY_LABELS } from "@/features/tickets/badges";
import { allowedCategoriesForCreate, allowedWorkstreamsForCreate } from "@/features/tickets/permissions";
import { useTicketMutations } from "@/features/tickets/hooks";
import { fetchPlants } from "@/api/plants";
import { fetchDepartments } from "@/api/departments";
import { fetchDesignations } from "@/api/designations";
import type { MachineStatus, MachineSummary, ProblemType, TicketCategory, Workstream } from "@/lib/types";

interface CreateTicketModalProps {
  visible: boolean;
  onClose: () => void;
  onCreated?: (ticketId: string) => void;
}

const PROBLEM_TYPES: ProblemType[] = ["ELECTRICAL", "MECHANICAL", "PNEUMATIC", "HYDRAULIC", "OTHERS"];
const MACHINE_STATUSES: MachineStatus[] = ["RUNNING", "STOPPED"];

export function CreateTicketModal({ visible, onClose, onCreated }: CreateTicketModalProps) {
  const user = useAuthStore((s) => s.user);
  const workstreamOptions = useMemo(() => allowedWorkstreamsForCreate(user?.role, user?.workstream), [user?.role, user?.workstream]);

  const [workstream, setWorkstream] = useState<Workstream | undefined>(workstreamOptions[0]);
  const isMaintenance = workstream === "MAINTENANCE";
  const [category, setCategory] = useState<TicketCategory | undefined>(undefined);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [plantId, setPlantId] = useState<string | undefined>();
  const [departmentId, setDepartmentId] = useState<string | undefined>();
  const [designationId, setDesignationId] = useState<string | undefined>();
  const [problemType, setProblemType] = useState<ProblemType | undefined>();
  const [machineStatus, setMachineStatus] = useState<MachineStatus>("RUNNING");
  const [machine, setMachine] = useState<MachineSummary | null>(null);
  const [assetId, setAssetId] = useState<string | undefined>();
  const [assetLabel, setAssetLabel] = useState<string | undefined>();
  const { create } = useTicketMutations();

  const categoryOptions = useMemo(
    () => (workstream ? allowedCategoriesForCreate(user?.role, workstream).map((v) => ({ value: v, label: TICKET_CATEGORY_LABELS[v] })) : []),
    [user?.role, workstream]
  );
  const { data: plants = [] } = useQuery({ queryKey: ["plants"], queryFn: fetchPlants, enabled: visible && isMaintenance });
  const { data: departments = [] } = useQuery({ queryKey: ["departments"], queryFn: fetchDepartments, enabled: visible && isMaintenance });
  const { data: designations = [] } = useQuery({ queryKey: ["designations"], queryFn: fetchDesignations, enabled: visible && isMaintenance });

  // Reset the form fields each time the modal opens. Adjusted during render
  // (React's documented pattern for "state that depends on a prop change")
  // rather than in an effect, which would set state synchronously after a
  // render and trigger an extra cascading render.
  const [prevVisible, setPrevVisible] = useState(visible);
  if (visible !== prevVisible) {
    setPrevVisible(visible);
    if (visible) {
      setWorkstream(workstreamOptions[0]);
      setCategory(undefined);
      setProblemType(undefined);
      setMachineStatus("RUNNING");
      setMachine(null);
      setPlantId(undefined);
      setDepartmentId(undefined);
      setDesignationId(undefined);
    }
  }

  function reset() {
    setWorkstream(workstreamOptions[0]);
    setCategory(undefined);
    setTitle("");
    setDescription("");
    setPlantId(undefined);
    setDepartmentId(undefined);
    setDesignationId(undefined);
    setProblemType(undefined);
    setMachineStatus("RUNNING");
    setMachine(null);
    setAssetId(undefined);
    setAssetLabel(undefined);
  }

  function handleSubmit() {
    if (!workstream) return;
    if (!isMaintenance && !category) return;
    create.mutate(
      isMaintenance
        ? { workstream, description: description.trim(), plantId, departmentId, designationId, problemType, machineStatus, maintenanceAssetId: machine?.id }
        : { workstream, category, title: title.trim(), description: description.trim(), itAssetId: assetId },
      {
        onSuccess: (ticket) => {
          reset();
          onClose();
          onCreated?.(ticket.id);
        },
      }
    );
  }

  const canSubmit = isMaintenance
    ? description.trim().length >= 3 && !!plantId && !!departmentId && !!problemType && !!machine
    : !!workstream && !!category && title.trim().length >= 3 && description.trim().length >= 3;

  if (workstreamOptions.length === 0) {
    return (
      <Modal visible={visible} title="Raise a ticket" onClose={onClose}>
        <View className="pb-4">
          <TextField editable={false} value="Your role cannot raise maintenance/IT tickets." />
        </View>
      </Modal>
    );
  }

  return (
    <Modal visible={visible} title="Raise a ticket" onClose={onClose}>
      <View className="gap-4 pb-4">
        <View className="flex-row justify-end">
          <ISTClock />
        </View>

        {workstreamOptions.length > 1 && (
          <SelectField
            label="Workstream"
            value={workstream}
            options={workstreamOptions.map((v) => ({ value: v, label: v === "MAINTENANCE" ? "Maintenance" : "IT" }))}
            onChange={(v) => {
              setWorkstream(v);
              setCategory(undefined);
              setAssetId(undefined);
              setAssetLabel(undefined);
            }}
          />
        )}
        {!isMaintenance && <SelectField label="Category" value={category} options={categoryOptions} onChange={setCategory} />}

        {isMaintenance ? (
          <>
            <SelectField
              label="Plant Location"
              value={plantId}
              options={plants.map((p) => ({ value: p.id, label: p.name }))}
              onChange={setPlantId}
            />
            <SelectField
              label="Department / Product Category"
              value={departmentId}
              options={departments.map((d) => ({ value: d.id, label: d.name }))}
              onChange={setDepartmentId}
            />
            <SelectField
              label="Designation (optional)"
              value={designationId}
              options={[{ value: "", label: "Not specified" }, ...designations.map((d) => ({ value: d.id, label: d.name }))]}
              onChange={(v) => setDesignationId(v || undefined)}
            />
            <MachinePicker value={machine} onChange={setMachine} />
            <SelectField
              label="Type of Problem"
              value={problemType}
              options={PROBLEM_TYPES.map((pt) => ({ value: pt, label: PROBLEM_TYPE_LABELS[pt] }))}
              onChange={setProblemType}
            />
            <View>
              <Text className="mb-1 text-sm font-medium text-soliflex-gray-700">Machine Status</Text>
              <View className="flex-row gap-2">
                {MACHINE_STATUSES.map((ms) => {
                  const active = machineStatus === ms;
                  return (
                    <View key={ms} className="flex-1">
                      <Button title={MACHINE_STATUS_LABELS[ms]} variant={active ? "primary" : "outline"} onPress={() => setMachineStatus(ms)} />
                    </View>
                  );
                })}
              </View>
            </View>
          </>
        ) : (
          <TextField label="Title" placeholder="Short summary (at least 3 characters)" value={title} onChangeText={setTitle} />
        )}

        <TextField
          label={isMaintenance ? "Problem Description" : "Description"}
          placeholder="What's the issue? (at least 3 characters)"
          value={description}
          onChangeText={setDescription}
          multiline
          numberOfLines={4}
          textAlignVertical="top"
          style={{ minHeight: 96 }}
        />

        {!isMaintenance && workstream && (
          <AssetPicker
            type="it"
            selectedLabel={assetLabel}
            onSelect={(id, l) => {
              setAssetId(id);
              setAssetLabel(l);
            }}
            onClear={() => {
              setAssetId(undefined);
              setAssetLabel(undefined);
            }}
          />
        )}
        <Button title="Raise ticket" onPress={handleSubmit} disabled={!canSubmit} loading={create.isPending} />
      </View>
    </Modal>
  );
}
