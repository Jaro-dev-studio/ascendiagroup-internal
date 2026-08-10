"use client";

import { useFormStatus } from "react-dom";
import { Button } from "@/components/ui/button";
import { type ButtonProps } from "@/components/ui/button";

interface FormSubmitButtonProps extends ButtonProps {
  children: React.ReactNode;
}

export function FormSubmitButton({
  children,
  ...props
}: FormSubmitButtonProps) {
  const { pending } = useFormStatus();

  return (
    <Button type="submit" isLoading={pending} {...props}>
      {children}
    </Button>
  );
}
