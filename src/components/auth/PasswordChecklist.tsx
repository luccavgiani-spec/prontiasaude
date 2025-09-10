import { Check, X } from "lucide-react";

interface PasswordChecklistProps {
  password: string;
}

interface Requirement {
  label: string;
  test: (password: string) => boolean;
}

const requirements: Requirement[] = [
  { label: "Letra maiúscula", test: (pwd) => /[A-Z]/.test(pwd) },
  { label: "Letra minúscula", test: (pwd) => /[a-z]/.test(pwd) },
  { label: "Número", test: (pwd) => /\d/.test(pwd) },
  { label: "Caractere especial", test: (pwd) => /[!@#$%^&*(),.?":{}|<>]/.test(pwd) }
];

export function PasswordChecklist({ password }: PasswordChecklistProps) {
  const allValid = requirements.every(req => req.test(password));

  return (
    <div className="space-y-2 p-3 bg-muted/30 rounded-lg border">
      <p className="text-sm font-medium text-foreground mb-2">Sua senha deve conter:</p>
      {requirements.map((req, index) => {
        const isValid = req.test(password);
        return (
          <div key={index} className="flex items-center gap-2 text-sm">
            {isValid ? (
              <Check className="h-4 w-4 text-green-600" />
            ) : (
              <X className="h-4 w-4 text-muted-foreground" />
            )}
            <span className={isValid ? "text-green-600" : "text-muted-foreground"}>
              {req.label}
            </span>
          </div>
        );
      })}
    </div>
  );
}

export function isPasswordValid(password: string): boolean {
  return requirements.every(req => req.test(password));
}