/**
 * Icon Test Page - Visual comparison of MynaUI vs Lucide icons
 * This page helps verify that MynaUI icons are rendering correctly with 1.5px stroke width
 * Temporary page for development testing only
 */

import {
  MenuIcon,
  SearchIcon,
  AddIcon,
  EditIcon,
  DeleteIcon,
  CheckIcon,
  CloseIcon,
  HomeIcon,
  SettingsIcon,
  ChevronDownIcon
} from '@/lib/icons';

import {
  Menu as LucideMenu,
  Search as LucideSearch,
  Plus as LucidePlus,
  Edit as LucideEdit,
  Trash as LucideDelete,
  Check as LucideCheck,
  X as LucideClose,
  Home as LucideHome,
  Settings as LucideSettings,
  ChevronDown as LucideChevronDown
} from 'lucide-react';

export default function IconTestPage() {
  const icons = [
    { name: 'Menu', MynaUI: MenuIcon, Lucide: LucideMenu },
    { name: 'Search', MynaUI: SearchIcon, Lucide: LucideSearch },
    { name: 'Add', MynaUI: AddIcon, Lucide: LucidePlus },
    { name: 'Edit', MynaUI: EditIcon, Lucide: LucideEdit },
    { name: 'Delete', MynaUI: DeleteIcon, Lucide: LucideDelete },
    { name: 'Check', MynaUI: CheckIcon, Lucide: LucideCheck },
    { name: 'Close', MynaUI: CloseIcon, Lucide: LucideClose },
    { name: 'Home', MynaUI: HomeIcon, Lucide: LucideHome },
    { name: 'Settings', MynaUI: SettingsIcon, Lucide: LucideSettings },
    { name: 'ChevronDownIcon', MynaUI: ChevronDownIcon, Lucide: LucideChevronDown },
  ];

  return (
    <div className="container mx-auto py-8 px-4">
      <h1 className="text-3xl font-bold mb-2">Icon Library Comparison</h1>
      <p className="text-muted-foreground mb-8">
        Visual comparison to verify MynaUI icons (1.5px stroke) vs Lucide icons (2px stroke)
      </p>

      <div className="grid gap-6">
        {icons.map(({ name, MynaUI, Lucide }) => (
          <div key={name} className="border rounded-lg p-6">
            <h3 className="font-semibold mb-4 text-lg">{name}</h3>

            <div className="grid grid-cols-2 gap-8">
              {/* MynaUI Column */}
              <div className="space-y-4">
                <div className="font-medium text-sm text-blue-600">MynaUI (1.5px stroke)</div>

                <div className="flex items-center gap-4">
                  <MynaUI className="h-6 w-6" />
                  <span className="text-sm text-muted-foreground">24px (default)</span>
                </div>

                <div className="flex items-center gap-4">
                  <MynaUI className="h-8 w-8" />
                  <span className="text-sm text-muted-foreground">32px (larger)</span>
                </div>

                <div className="flex items-center gap-4">
                  <MynaUI className="h-12 w-12" />
                  <span className="text-sm text-muted-foreground">48px (very large)</span>
                </div>

                {/* Explicit stroke width test */}
                <div className="flex items-center gap-4 border-t pt-4">
                  <MynaUI className="h-12 w-12" strokeWidth={1.5} />
                  <span className="text-sm text-muted-foreground">Explicit 1.5px</span>
                </div>
              </div>

              {/* Lucide Column */}
              <div className="space-y-4">
                <div className="font-medium text-sm text-amber-600">Lucide (2px stroke)</div>

                <div className="flex items-center gap-4">
                  <Lucide className="h-6 w-6" />
                  <span className="text-sm text-muted-foreground">24px (default)</span>
                </div>

                <div className="flex items-center gap-4">
                  <Lucide className="h-8 w-8" />
                  <span className="text-sm text-muted-foreground">32px (larger)</span>
                </div>

                <div className="flex items-center gap-4">
                  <Lucide className="h-12 w-12" />
                  <span className="text-sm text-muted-foreground">48px (very large)</span>
                </div>

                {/* Explicit stroke width test */}
                <div className="flex items-center gap-4 border-t pt-4">
                  <Lucide className="h-12 w-12" strokeWidth={2} />
                  <span className="text-sm text-muted-foreground">Explicit 2px</span>
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>

      <div className="mt-8 p-6 bg-blue-50 dark:bg-blue-950 rounded-lg">
        <h3 className="font-semibold mb-2">What to look for:</h3>
        <ul className="list-disc list-inside space-y-1 text-sm">
          <li><strong>MynaUI icons should appear thinner/more delicate</strong> (1.5px stroke)</li>
          <li><strong>Lucide icons should appear bolder/thicker</strong> (2px stroke)</li>
          <li>The difference is most visible at larger sizes (48px)</li>
          <li>Both should maintain the same overall shape and style</li>
        </ul>
      </div>
    </div>
  );
}
