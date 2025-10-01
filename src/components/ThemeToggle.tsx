"use client"

import * as React from "react"
import { Moon, Sun } from "@/lib/icons"
import { Button } from "@/components/ui/button"
import { useTheme } from "@/hooks/use-theme.tsx"
import { cn } from "@/lib/utils"

interface ThemeToggleProps {
  className?: string
  variant?: "default" | "ghost" | "outline"
  size?: "default" | "sm" | "lg" | "icon"
}

export function ThemeToggle({
  className,
  variant = "ghost",
  size = "sm"
}: ThemeToggleProps) {
  const { theme, setTheme } = useTheme()
  const [mounted, setMounted] = React.useState(false)

  React.useEffect(() => {
    setMounted(true)
  }, [])

  if (!mounted) {
    return (
      <Button variant={variant} size={size} className={cn("w-9 px-0", className)} disabled>
        <Sun className="h-[1.2rem] w-[1.2rem]" />
        <span className="sr-only">Toggle theme</span>
      </Button>
    )
  }

  const handleToggle = () => {
    setTheme(theme === "light" ? "dark" : "light")
  }

  return (
    <Button
      variant={variant}
      size={size}
      onClick={handleToggle}
      className={cn(
        "w-9 px-0 relative overflow-hidden group transition-all duration-300 ease-in-out",
        "hover:bg-accent hover:scale-105",
        className
      )}
      aria-label={`Switch to ${theme === "light" ? "dark" : "light"} mode`}
    >
      {/* Sun Icon - visible in light mode */}
      <Sun
        className={cn(
          "h-[1.2rem] w-[1.2rem] transition-all duration-500",
          "rotate-0 scale-100",
          theme === "dark" && "rotate-90 scale-0"
        )}
      />

      {/* Moon Icon - visible in dark mode */}
      <Moon
        className={cn(
          "absolute inset-0 h-[1.2rem] w-[1.2rem] transition-all duration-500",
          "rotate-90 scale-0",
          theme === "dark" && "rotate-0 scale-100"
        )}
      />

      <span className="sr-only">
        Switch to {theme === "light" ? "dark" : "light"} mode
      </span>
    </Button>
  )
}

// Compact version for mobile/navigation
export function CompactThemeToggle({ className }: { className?: string }) {
  const { theme, setTheme } = useTheme()
  const [mounted, setMounted] = React.useState(false)

  React.useEffect(() => {
    setMounted(true)
  }, [])

  if (!mounted) {
    return (
      <button className={cn("w-8 h-8 flex items-center justify-center", className)} disabled>
        <Sun className="h-4 w-4" />
      </button>
    )
  }

  return (
    <button
      onClick={() => setTheme(theme === "light" ? "dark" : "light")}
      className={cn(
        "w-8 h-8 rounded-lg flex items-center justify-center transition-all duration-300",
        "hover:bg-accent hover:scale-110 focus:outline-none focus:ring-2 focus:ring-ring",
        className
      )}
      aria-label={`Switch to ${theme === "light" ? "dark" : "light"} mode`}
    >
      {theme === "light" ? (
        <Moon className="h-4 w-4 transition-all duration-300" />
      ) : (
        <Sun className="h-4 w-4 transition-all duration-300" />
      )}
    </button>
  )
}

// Advanced version with system theme option
export function AdvancedThemeToggle({
  className,
  includeSystem = false
}: {
  className?: string
  includeSystem?: boolean
}) {
  const { theme, setTheme } = useTheme()
  const [mounted, setMounted] = React.useState(false)

  React.useEffect(() => {
    setMounted(true)
  }, [])

  if (!mounted) {
    return (
      <Button variant="outline" size="sm" disabled>
        <Sun className="h-4 w-4 mr-2" />
        Theme
      </Button>
    )
  }

  const getIcon = () => {
    switch (theme) {
      case "light":
        return <Sun className="h-4 w-4" />
      case "dark":
        return <Moon className="h-4 w-4" />
      default:
        return <Sun className="h-4 w-4" />
    }
  }

  const getLabel = () => {
    switch (theme) {
      case "light":
        return "Light"
      case "dark":
        return "Dark"
      case "system":
        return "System"
      default:
        return "Light"
    }
  }

  return (
    <Button
      variant="outline"
      size="sm"
      onClick={() => {
        if (includeSystem && theme === "light") {
          setTheme("dark")
        } else if (includeSystem && theme === "dark") {
          setTheme("system")
        } else {
          setTheme("light")
        }
      }}
      className={cn(
        "transition-all duration-300 hover:scale-105",
        "focus:ring-2 focus:ring-ring focus:outline-none",
        className
      )}
    >
      {getIcon()}
      <span className="ml-2 hidden sm:inline">{getLabel()}</span>
    </Button>
  )
}
