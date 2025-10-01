"use client"

import * as React from "react"

type Theme = "dark" | "light" | "system"

type ThemeProviderProps = {
  children: React.ReactNode
  defaultTheme?: Theme
  storageKey?: string
  attribute?: string
  enableSystem?: boolean
  disableTransitionOnChange?: boolean
}

type ThemeProviderState = {
  theme: Theme
  setTheme: (theme: Theme) => void
}

const initialState: ThemeProviderState = {
  theme: "system",
  setTheme: () => null,
}

const ThemeProviderContext = React.createContext<ThemeProviderState>(initialState)

export function ThemeProvider({
  children,
  defaultTheme = "system",
  storageKey = "vite-ui-theme",
  attribute = "class",
  enableSystem = true,
  disableTransitionOnChange = false,
  ...props
}: ThemeProviderProps) {
  const [theme, setTheme] = React.useState<Theme>(
    () => (typeof window !== "undefined" && window.localStorage.getItem(storageKey)) as Theme || defaultTheme
  )

  const [mounted, setMounted] = React.useState(false)

  React.useEffect(() => {
    setMounted(true)
  }, [])

  React.useEffect(() => {
    const root = window.document.documentElement

    // Remove existing theme classes
    root.classList.remove("light", "dark")

    if (theme === "system" && enableSystem) {
      const systemTheme = window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light"
      root.classList.add(systemTheme)
      return
    }

    root.classList.add(theme)
  }, [theme, attribute, enableSystem])

  // Prevent hydration mismatch
  if (!mounted) {
    return <div style={{ visibility: "hidden" }}>{children}</div>
  }

  const value = {
    theme,
    setTheme: (theme: Theme) => {
      try {
        const root = window.document.documentElement

        // Disable transitions when switching themes
        if (disableTransitionOnChange) {
          root.style.setProperty("color-scheme", "dark")
          root.style.setProperty("--transition-duration", "0s")
        }

        localStorage.setItem(storageKey, theme)
        setTheme(theme)

        // Re-enable transitions after theme change
        if (disableTransitionOnChange) {
          setTimeout(() => {
            root.style.removeProperty("--transition-duration")
          }, 150)
        }
      } catch (error) {
        console.error("Failed to set theme:", error)
      }
    },
  }

  return (
    <ThemeProviderContext.Provider {...props} value={value}>
      {children}
    </ThemeProviderContext.Provider>
  )
}

export const useTheme = () => {
  const context = React.useContext(ThemeProviderContext)

  if (context === undefined)
    throw new Error("useTheme must be used within a ThemeProvider")

  return context
}
