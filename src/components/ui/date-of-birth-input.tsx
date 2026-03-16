import { useState, useRef, useEffect } from "react";
import { cn } from "@/lib/utils";

interface DateOfBirthInputProps {
  value: string; // "YYYY-MM-DD" or ""
  onChange: (isoDate: string) => void;
  onBlur?: () => void;
  error?: boolean;
}

export function DateOfBirthInput({ value, onChange, onBlur, error }: DateOfBirthInputProps) {
  const [day, setDay] = useState("");
  const [month, setMonth] = useState("");
  const [year, setYear] = useState("");

  const dayRef = useRef<HTMLInputElement>(null);
  const monthRef = useRef<HTMLInputElement>(null);
  const yearRef = useRef<HTMLInputElement>(null);

  // Parse incoming value (YYYY-MM-DD) into day/month/year
  useEffect(() => {
    if (value) {
      const parts = value.split("-");
      if (parts.length === 3) {
        setYear(parts[0]);
        setMonth(parts[1]);
        setDay(parts[2]);
      }
    } else {
      setDay("");
      setMonth("");
      setYear("");
    }
  }, [value]);

  const emitChange = (d: string, m: string, y: string) => {
    if (d && m && y.length === 4) {
      const dayNum = parseInt(d, 10);
      const monthNum = parseInt(m, 10);
      const yearNum = parseInt(y, 10);
      const currentYear = new Date().getFullYear();

      if (
        dayNum >= 1 && dayNum <= 31 &&
        monthNum >= 1 && monthNum <= 12 &&
        yearNum >= 1900 && yearNum <= currentYear
      ) {
        const iso = `${y}-${m.padStart(2, "0")}-${d.padStart(2, "0")}`;
        onChange(iso);
        return;
      }
    }
    onChange("");
  };

  const handleDay = (val: string) => {
    const digits = val.replace(/\D/g, "").slice(0, 2);
    setDay(digits);
    emitChange(digits, month, year);
    if (digits.length === 2) {
      monthRef.current?.focus();
    }
  };

  const handleMonth = (val: string) => {
    const digits = val.replace(/\D/g, "").slice(0, 2);
    setMonth(digits);
    emitChange(day, digits, year);
    if (digits.length === 2) {
      yearRef.current?.focus();
    }
  };

  const handleYear = (val: string) => {
    const digits = val.replace(/\D/g, "").slice(0, 4);
    setYear(digits);
    emitChange(day, month, digits);
  };

  const handleKeyDown = (
    e: React.KeyboardEvent<HTMLInputElement>,
    field: "day" | "month" | "year"
  ) => {
    if (e.key === "Backspace") {
      if (field === "month" && month === "") {
        dayRef.current?.focus();
      } else if (field === "year" && year === "") {
        monthRef.current?.focus();
      }
    }
  };

  const inputClass = cn(
    "flex h-10 rounded-md border bg-background px-3 py-2 text-sm ring-offset-background",
    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
    "placeholder:text-muted-foreground",
    error ? "border-destructive" : "border-input"
  );

  return (
    <div className="flex items-center gap-2">
      <input
        ref={dayRef}
        type="text"
        inputMode="numeric"
        pattern="[0-9]*"
        placeholder="DD"
        value={day}
        onChange={(e) => handleDay(e.target.value)}
        onKeyDown={(e) => handleKeyDown(e, "day")}
        onBlur={onBlur}
        className={cn(inputClass, "w-16 text-center")}
        aria-label="Dia"
      />
      <span className="text-muted-foreground">/</span>
      <input
        ref={monthRef}
        type="text"
        inputMode="numeric"
        pattern="[0-9]*"
        placeholder="MM"
        value={month}
        onChange={(e) => handleMonth(e.target.value)}
        onKeyDown={(e) => handleKeyDown(e, "month")}
        onBlur={onBlur}
        className={cn(inputClass, "w-16 text-center")}
        aria-label="Mês"
      />
      <span className="text-muted-foreground">/</span>
      <input
        ref={yearRef}
        type="text"
        inputMode="numeric"
        pattern="[0-9]*"
        placeholder="AAAA"
        value={year}
        onChange={(e) => handleYear(e.target.value)}
        onKeyDown={(e) => handleKeyDown(e, "year")}
        onBlur={onBlur}
        className={cn(inputClass, "w-24 text-center")}
        aria-label="Ano"
      />
    </div>
  );
}
