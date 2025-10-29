import * as React from "react"
import { Slot } from "@radix-ui/react-slot"
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "@/lib/utils"

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-xl text-sm font-medium transition-[var(--transition-smooth)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0 min-h-[48px] min-w-[48px]",
  {
    variants: {
      variant: {
        default: "bg-primary text-primary-foreground hover:bg-primary-glow shadow-[var(--shadow-button)]",
        destructive: "bg-secondary text-secondary-foreground hover:bg-secondary-glow shadow-[var(--shadow-button)]",
        outline: "border-2 border-primary bg-background text-primary hover:bg-primary hover:text-primary-foreground",
        secondary: "bg-muted text-foreground hover:bg-muted-dark hover:text-primary-foreground",
        ghost: "hover:bg-muted hover:text-foreground",
        link: "text-primary underline-offset-4 hover:underline min-h-0 min-w-0",
        // Variantes médicas personalizadas com contraste aprimorado
        medical: "bg-[var(--gradient-primary)] text-primary-foreground hover:shadow-[var(--shadow-medical)] transform hover:scale-[1.02] font-semibold",
        emergency: "bg-[var(--gradient-secondary)] text-secondary-foreground hover:shadow-[var(--shadow-medical)] transform hover:scale-[1.02] font-semibold",
        highlight: "bg-accent text-foreground hover:bg-accent-light shadow-[var(--shadow-button)] font-semibold",
        hero: "bg-[var(--gradient-hero)] text-primary-foreground hover:shadow-[var(--shadow-medical)] transform hover:scale-[1.02] text-base font-bold"
      },
      size: {
        default: "h-12 px-6 py-3",
        sm: "h-10 rounded-lg px-4 py-2",
        lg: "h-14 rounded-xl px-10 py-4",
        xl: "h-16 rounded-2xl px-12 py-5 text-lg font-bold",
        icon: "h-12 w-12",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
)

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : "button"
    return (
      <Comp
        className={cn(buttonVariants({ variant, size, className }))}
        ref={ref}
        {...props}
      />
    )
  }
)
Button.displayName = "Button"

export { Button, buttonVariants }