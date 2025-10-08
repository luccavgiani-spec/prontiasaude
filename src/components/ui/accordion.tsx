import * as React from "react";
import * as AccordionPrimitive from "@radix-ui/react-accordion";
import { ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";
const Accordion = AccordionPrimitive.Root;
const AccordionItem = React.forwardRef<React.ElementRef<typeof AccordionPrimitive.Item>, React.ComponentPropsWithoutRef<typeof AccordionPrimitive.Item>>(({
  className,
  ...props
}, ref) => <AccordionPrimitive.Item ref={ref} className={cn("border-b", className)} {...props} />);
AccordionItem.displayName = "AccordionItem";
const AccordionTrigger = React.forwardRef<React.ElementRef<typeof AccordionPrimitive.Trigger>, React.ComponentPropsWithoutRef<typeof AccordionPrimitive.Trigger>>(({
  className,
  children,
  ...props
}, ref) => <AccordionPrimitive.Header className="flex">
    <AccordionPrimitive.Trigger ref={ref} className={cn("flex flex-1 items-center justify-between py-4 font-medium transition-all hover:underline [&[data-state=open]>svg]:rotate-180", className)} {...props}>
      {children}
      <ChevronDown className="h-4 w-4 shrink-0 transition-transform duration-200" />
    </AccordionPrimitive.Trigger>
  </AccordionPrimitive.Header>);
AccordionTrigger.displayName = AccordionPrimitive.Trigger.displayName;
const AccordionContent = React.forwardRef<React.ElementRef<typeof AccordionPrimitive.Content>, React.ComponentPropsWithoutRef<typeof AccordionPrimitive.Content>>(({
  className,
  children,
  ...props
}, ref) => {
  const formatContent = (content: React.ReactNode) => {
    if (typeof content === 'string') {
      // Split by bullet points and format as paragraphs
      const parts = content.split('•').filter(part => part.trim());
      if (parts.length > 1) {
        return <div className="space-y-2">
            <p>{parts[0].trim()}</p>
            
          </div>;
      }

      // Handle regular paragraphs by splitting on double line breaks
      const paragraphs = content.split('\n\n').filter(p => p.trim());
      if (paragraphs.length > 1) {
        return <div className="space-y-3">
            {paragraphs.map((paragraph, index) => <p key={index}>{paragraph.trim()}</p>)}
          </div>;
      }
      return <p>{content}</p>;
    }
    return children;
  };
  return <AccordionPrimitive.Content ref={ref} className="overflow-hidden text-sm transition-all data-[state=closed]:animate-accordion-up data-[state=open]:animate-accordion-down" {...props}>
      <div className={cn("pb-4 pt-0", className)}>
        {formatContent(children)}
      </div>
    </AccordionPrimitive.Content>;
});
AccordionContent.displayName = AccordionPrimitive.Content.displayName;
export { Accordion, AccordionItem, AccordionTrigger, AccordionContent };