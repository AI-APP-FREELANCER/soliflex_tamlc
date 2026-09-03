import { useEffect, useRef } from "react";
import { Html5Qrcode } from "html5-qrcode";
import { Modal } from "./Modal";

export function QrScannerModal({ onDetected, onClose }: { onDetected: (code: string) => void; onClose: () => void }) {
  const containerId = useRef(`qr-reader-${Math.random().toString(36).slice(2)}`);
  const scannerRef = useRef<Html5Qrcode | null>(null);

  useEffect(() => {
    const scanner = new Html5Qrcode(containerId.current);
    scannerRef.current = scanner;
    let stopped = false;

    scanner
      .start(
        { facingMode: "environment" },
        { fps: 10, qrbox: 220 },
        (decodedText) => {
          if (stopped) return;
          stopped = true;
          onDetected(decodedText);
          scanner.stop().catch(() => {});
        },
        () => {}
      )
      .catch(() => {
        // camera unavailable — user can still cancel and type the item code manually
      });

    return () => {
      stopped = true;
      scanner.stop().catch(() => {});
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <Modal title="Scan asset QR code" onClose={onClose}>
      <div id={containerId.current} className="mx-auto w-full max-w-xs overflow-hidden rounded-lg" />
      <p className="mt-3 text-center text-xs text-soliflex-gray-400">Point the camera at the asset's QR code sticker.</p>
    </Modal>
  );
}
