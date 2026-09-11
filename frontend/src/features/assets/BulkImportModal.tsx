import { useRef, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import toast from "react-hot-toast";
import { Download, Upload, CheckCircle2, XCircle } from "lucide-react";
import { Modal } from "../../components/Modal";
import { apiErrorMessage } from "../../lib/api";
import type { BulkImportResult } from "./api";

function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

export function BulkImportModal({
  title,
  templateFileName,
  downloadTemplate,
  bulkImport,
  invalidateKey,
  onClose,
}: {
  title: string;
  templateFileName: string;
  downloadTemplate: () => Promise<Blob>;
  bulkImport: (file: File) => Promise<BulkImportResult>;
  invalidateKey: string;
  onClose: () => void;
}) {
  const [file, setFile] = useState<File | null>(null);
  const [result, setResult] = useState<BulkImportResult | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const queryClient = useQueryClient();

  const downloadMutation = useMutation({
    mutationFn: downloadTemplate,
    onSuccess: (blob) => downloadBlob(blob, templateFileName),
    onError: (err) => toast.error(apiErrorMessage(err)),
  });

  const importMutation = useMutation({
    mutationFn: bulkImport,
    onSuccess: (res) => {
      setResult(res);
      queryClient.invalidateQueries({ queryKey: [invalidateKey] });
      if (res.imported > 0) toast.success(`Imported ${res.imported} asset${res.imported === 1 ? "" : "s"}`);
      if (res.failed === 0 && res.imported > 0) toast.success("All rows imported successfully");
    },
    onError: (err) => toast.error(apiErrorMessage(err)),
  });

  return (
    <Modal title={title} onClose={onClose} width="max-w-xl">
      <div className="space-y-4">
        <div className="rounded-lg border border-soliflex-gray-100 bg-soliflex-gray-50 p-4">
          <p className="mb-2 text-sm text-soliflex-gray-600">
            Download the CSV template, fill in one row per asset, then upload it below. Up to 500 rows per upload.
          </p>
          <button
            onClick={() => downloadMutation.mutate()}
            disabled={downloadMutation.isPending}
            className="flex items-center gap-1.5 rounded-lg bg-white px-3 py-1.5 text-sm font-semibold text-soliflex-ink shadow-sm ring-1 ring-soliflex-gray-200 hover:bg-soliflex-gray-50 disabled:opacity-50"
          >
            <Download className="h-4 w-4" /> Download CSV template
          </button>
        </div>

        <div>
          <input
            ref={fileInputRef}
            type="file"
            accept=".csv"
            hidden
            onChange={(e) => {
              setFile(e.target.files?.[0] ?? null);
              setResult(null);
            }}
          />
          <button
            onClick={() => fileInputRef.current?.click()}
            className="flex w-full items-center justify-center gap-1.5 rounded-lg border border-dashed border-soliflex-gray-300 px-3 py-4 text-sm font-medium text-soliflex-gray-600 hover:border-soliflex-orange-300 hover:text-soliflex-orange-600"
          >
            <Upload className="h-4 w-4" /> {file ? file.name : "Choose a filled-in CSV file"}
          </button>
        </div>

        <button
          onClick={() => file && importMutation.mutate(file)}
          disabled={!file || importMutation.isPending}
          className="w-full rounded-lg bg-soliflex-orange-500 px-4 py-2.5 text-sm font-semibold text-white hover:bg-soliflex-orange-600 disabled:opacity-50"
        >
          {importMutation.isPending ? "Uploading…" : "Upload and import"}
        </button>

        {result && (
          <div className="space-y-2 rounded-lg border border-soliflex-gray-100 p-3 text-sm">
            <div className="flex items-center gap-1.5 text-green-700">
              <CheckCircle2 className="h-4 w-4" /> {result.imported} imported
            </div>
            {result.failed > 0 && (
              <div>
                <div className="mb-1 flex items-center gap-1.5 text-red-700">
                  <XCircle className="h-4 w-4" /> {result.failed} failed
                </div>
                <ul className="max-h-40 space-y-1 overflow-y-auto rounded-md bg-red-50 p-2 text-xs text-red-800">
                  {result.errors.map((e, i) => (
                    <li key={i}>
                      Row {e.row}: {e.message}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        )}
      </div>
    </Modal>
  );
}
