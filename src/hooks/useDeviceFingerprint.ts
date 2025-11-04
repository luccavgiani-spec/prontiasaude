import { useState, useEffect } from 'react';
import FingerprintJS from '@fingerprintjs/fingerprintjs';

interface DeviceFingerprint {
  os: string;
  system_version: string;
  model: string;
  RAM: number;
  disk_space: number;
  vendor_ids: Array<{ name: string; value: string }>;
  resolution: string;
}

export function useDeviceFingerprint() {
  const [fingerprint, setFingerprint] = useState<DeviceFingerprint | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const captureFingerprint = async () => {
      try {
        // Capturar informações do dispositivo
        const fp = await FingerprintJS.load();
        const result = await fp.get();

        // Capturar espaço em disco (se disponível)
        let diskSpace = 0;
        if ('storage' in navigator && 'estimate' in navigator.storage) {
          const estimate = await navigator.storage.estimate();
          diskSpace = Math.round((estimate.quota || 0) / 1024 / 1024); // MB
        }

        const deviceFingerprint: DeviceFingerprint = {
          os: navigator.platform || 'Unknown',
          system_version: navigator.userAgent.match(/\(([^)]+)\)/)?.[1] || 'Unknown',
          model: navigator.userAgent.match(/\(([^)]+)\)/)?.[1] || 'Unknown',
          RAM: (navigator as any).deviceMemory ? (navigator as any).deviceMemory * 1024 : 4096,
          disk_space: diskSpace,
          vendor_ids: [
            { name: 'fingerprint', value: result.visitorId },
            { name: 'browser', value: crypto.randomUUID() }
          ],
          resolution: `${screen.width}x${screen.height}`
        };

        console.log('[Device Fingerprint] ✅ Captured:', deviceFingerprint);
        setFingerprint(deviceFingerprint);
      } catch (error) {
        console.error('[Device Fingerprint] ❌ Error:', error);
      } finally {
        setIsLoading(false);
      }
    };

    captureFingerprint();
  }, []);

  return { fingerprint, isLoading };
}
