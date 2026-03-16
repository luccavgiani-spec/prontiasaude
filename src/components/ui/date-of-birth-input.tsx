import { useState, useEffect } from "react";
import { cn } from "@/lib/utils";

interface DateOfBirthInputProps {
  value: string; // "YYYY-MM-DD" or ""
  onChange: (isoDate: string) => void;
  onBlur?: () => void;
  error?: boolean;
}

function formatDateMask(digits: string): string {
  // Applies DD/MM/AAAA mask to raw digits
  if (digits.length <= 2) return digits;
  if (digits.length <= 4) return `${digits.slice(0, 2)}/${digits.slice(2)}`;
  return `${digits.slice(0, 2)}/${digits.slice(2, 4)}/${digits.slice(4, 8)}`;
}

function isoToDisplay(iso: string): string {
  // Converts "YYYY-MM-DD" to "DD/MM/YYYY"
  const parts = iso.split("-");
  if (parts.length === 3) return `${parts[2]}/${parts[1]}/${parts[0]}`;
  return "";
}

function digitsToIso(digits: string): string {
  // Converts 8 raw digits (DDMMYYYY) to "YYYY-MM-DD"
  if (digits.length !== 8) return "";
  const dd = digits.slice(0, 2);
  const mm = digits.slice(2, 4);
  const yyyy = digits.slice(4, 8);
  const dayNum = parseInt(dd, 10);
  const monthNum = parseInt(mm, 10);
  const yearNum = parseInt(yyyy, 10);
  const currentYear = new Date().getFullYear();
  if (dayNum < 1 || dayNum > 31) return "";
  if (monthNum < 1 || monthNum > 12) return "";
  if (yearNum < 1900 || yearNum > currentYear) return "";
  return `${yyyy}-${mm}-${dd}`;
}

export function DateOfBirthInput({ value, onChange, onBlur, error }: DateOfBirthInputProps) {
  const [display, setDisplay] = useState("");

  // Sync from parent value (YYYY-MM-DD) on mount or external changes
  useEffect(() => {
    if (value) {
      const formatted = isoToDisplay(value);
      if (formatted) {
        setDisplay(formatted);
        return;
      }
    }
    setDisplay("");
  }, [value]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const raw = e.target.value.replace(/\D/g, "").slice(0, 8);
    const masked = formatDateMask(raw);
    setDisplay(masked);

    const iso = digitsToIso(raw);
    onChange(iso);
  };

  return (
    <input
      type="text"
      inputMode="numeric"
      placeholder="DD/MM/AAAA"
      value={display}
      onChange={handleChange}
      onBlur={onBlur}
      maxLength={10}
      className={cn(
        "flex h-10 w-full rounded-md border bg-background px-3 py-2 text-sm ring-offset-background",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
        "placeholder:text-muted-foreground",
        error ? "border-destructive" : "border-input"
      )}
      aria-label="Data de nascimento"
    />
  );
}
