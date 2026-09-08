import React from 'react';
import { Toaster as Sonner } from "sonner"

type ToasterProps = React.ComponentProps<typeof Sonner>

const Toaster = ({ ...props }: ToasterProps) => {
  return (
    <Sonner
      theme="system"
      className="toaster group"
      toastOptions={{
        classNames: {
          // The surface is scoped to sonner's own styled toasts: a custom
          // JSX toast (`useToast().celebrate`) draws its whole box itself,
          // and a white, shadowed <li> behind it would show at the corners.
          toast:
            "group toast group-[.toaster]:data-[styled=true]:bg-white group-[.toaster]:data-[styled=true]:text-gray-950 group-[.toaster]:data-[styled=true]:border-gray-200 group-[.toaster]:data-[styled=true]:shadow-lg",
          description: "group-[.toast]:text-gray-500",
          actionButton:
            "group-[.toast]:bg-accent-terracotta group-[.toast]:text-white",
          cancelButton:
            "group-[.toast]:bg-gray-100 group-[.toast]:text-gray-500",
        },
      }}
      {...props}
    />
  )
}

export { Toaster }
