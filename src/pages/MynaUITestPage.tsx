import React from 'react';
import { EnhancedButton } from '@/components/myna/elements/enhanced-button';
import {
  EnhancedCard,
  EnhancedCardHeader,
  EnhancedCardTitle,
  EnhancedCardDescription,
  EnhancedCardContent,
  EnhancedCardFooter
} from '@/components/myna/elements/enhanced-card';
import { EnhancedAvatar } from '@/components/myna/elements/enhanced-avatar';
import { StarIcon, Heart, DownloadIcon, UploadIcon, SettingsIcon, UserIcon } from "@/lib/icons";

const MynaUITestPage = () => {
  return (
    <div className="min-h-screen bg-background p-8">
      <div className="max-w-6xl mx-auto space-y-12">
        {/* Header */}
        <div className="text-center space-y-4">
          <h1 className="text-4xl font-bold text-foreground">
            MynaUI + Ingrid Components Test
          </h1>
          <p className="text-lg text-muted-foreground">
            Testing our enhanced components with OKLCH colors and Geist typography
          </p>
        </div>

        {/* Enhanced Buttons Section */}
        <section className="space-y-6">
          <h2 className="text-2xl font-semibold text-foreground">Enhanced Buttons</h2>

          {/* Default Variants */}
          <div className="space-y-4">
            <h3 className="text-lg font-medium text-muted-foreground">Variants</h3>
            <div className="flex flex-wrap gap-4">
              <EnhancedButton variant="default">Default</EnhancedButton>
              <EnhancedButton variant="destructive">Destructive</EnhancedButton>
              <EnhancedButton variant="outline">Outline</EnhancedButton>
              <EnhancedButton variant="secondary">Secondary</EnhancedButton>
              <EnhancedButton variant="ghost">Ghost</EnhancedButton>
              <EnhancedButton variant="gradient">Gradient</EnhancedButton>
              <EnhancedButton variant="neural">Neural AI</EnhancedButton>
              <EnhancedButton variant="success">Success</EnhancedButton>
              <EnhancedButton variant="warning">Warning</EnhancedButton>
              <EnhancedButton variant="glass">Glass</EnhancedButton>
            </div>
          </div>

          {/* Sizes */}
          <div className="space-y-4">
            <h3 className="text-lg font-medium text-muted-foreground">Sizes</h3>
            <div className="flex items-center gap-4">
              <EnhancedButton size="sm">Small</EnhancedButton>
              <EnhancedButton size="default">Default</EnhancedButton>
              <EnhancedButton size="lg">Large</EnhancedButton>
              <EnhancedButton size="xl">Extra Large</EnhancedButton>
            </div>
          </div>

          {/* Animations */}
          <div className="space-y-4">
            <h3 className="text-lg font-medium text-muted-foreground">Animations</h3>
            <div className="flex flex-wrap gap-4">
              <EnhancedButton animation="none">No Animation</EnhancedButton>
              <EnhancedButton animation="subtle">Subtle</EnhancedButton>
              <EnhancedButton animation="lift">Lift</EnhancedButton>
              <EnhancedButton animation="glow">Glow</EnhancedButton>
            </div>
          </div>

          {/* With Icons */}
          <div className="space-y-4">
            <h3 className="text-lg font-medium text-muted-foreground">With Icons</h3>
            <div className="flex flex-wrap gap-4">
              <EnhancedButton leftIcon={<StarIcon className="h-4 w-4" />}>
                Starred
              </EnhancedButton>
              <EnhancedButton rightIcon={<DownloadIcon className="h-4 w-4" />} variant="neural">
                Download
              </EnhancedButton>
              <EnhancedButton
                leftIcon={<UploadIcon className="h-4 w-4" />}
                rightIcon={<Heart className="h-4 w-4" />}
                variant="gradient"
              >
                Upload & Like
              </EnhancedButton>
            </div>
          </div>

          {/* Loading States */}
          <div className="space-y-4">
            <h3 className="text-lg font-medium text-muted-foreground">Loading States</h3>
            <div className="flex flex-wrap gap-4">
              <EnhancedButton loading>Loading...</EnhancedButton>
              <EnhancedButton loading loadingText="Processing" variant="neural">
                Process
              </EnhancedButton>
              <EnhancedButton loading variant="success">
                Success Action
              </EnhancedButton>
            </div>
          </div>
        </section>

        {/* Enhanced Cards Section */}
        <section className="space-y-6">
          <h2 className="text-2xl font-semibold text-foreground">Enhanced Cards</h2>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {/* Default Card */}
            <EnhancedCard variant="default">
              <EnhancedCardHeader>
                <EnhancedCardTitle>Default Card</EnhancedCardTitle>
                <EnhancedCardDescription>
                  This is a default card with standard styling.
                </EnhancedCardDescription>
              </EnhancedCardHeader>
              <EnhancedCardContent>
                <p className="text-sm text-muted-foreground">
                  Card content goes here. This demonstrates the MynaUI card component
                  with enhanced styling and smooth animations.
                </p>
              </EnhancedCardContent>
              <EnhancedCardFooter>
                <EnhancedButton size="sm">Action</EnhancedButton>
              </EnhancedCardFooter>
            </EnhancedCard>

            {/* Interactive Card */}
            <EnhancedCard
              variant="interactive"
              animation="lift"
              onCardClick={() => alert('Card clicked!')}
            >
              <EnhancedCardHeader>
                <EnhancedCardTitle>Interactive Card</EnhancedCardTitle>
                <EnhancedCardDescription>
                  Click anywhere on this card to trigger an action.
                </EnhancedCardDescription>
              </EnhancedCardHeader>
              <EnhancedCardContent>
                <p className="text-sm text-muted-foreground">
                  This card has hover effects and click handling. Perfect for
                  dashboard tiles and actionable content.
                </p>
              </EnhancedCardContent>
            </EnhancedCard>

            {/* Neural AI Card */}
            <EnhancedCard variant="neural" animation="glow">
              <EnhancedCardHeader>
                <EnhancedCardTitle className="text-primary">Neural AI Card</EnhancedCardTitle>
                <EnhancedCardDescription>
                  AI-themed styling for Ingrid components.
                </EnhancedCardDescription>
              </EnhancedCardHeader>
              <EnhancedCardContent>
                <p className="text-sm text-muted-foreground">
                  This card uses the neural variant with AI-inspired colors
                  and subtle gradient backgrounds.
                </p>
              </EnhancedCardContent>
              <EnhancedCardFooter>
                <EnhancedButton variant="neural" size="sm">
                  AI Action
                </EnhancedButton>
              </EnhancedCardFooter>
            </EnhancedCard>

            {/* Glass Card */}
            <EnhancedCard variant="glass" animation="subtle">
              <EnhancedCardHeader>
                <EnhancedCardTitle>Glass Card</EnhancedCardTitle>
                <EnhancedCardDescription>
                  Glassmorphism effect for modern UI.
                </EnhancedCardDescription>
              </EnhancedCardHeader>
              <EnhancedCardContent>
                <p className="text-sm text-muted-foreground">
                  This card demonstrates the glass morphism effect with
                  backdrop blur and transparency.
                </p>
              </EnhancedCardContent>
            </EnhancedCard>

            {/* Success Card */}
            <EnhancedCard variant="success">
              <EnhancedCardHeader>
                <EnhancedCardTitle>Success Card</EnhancedCardTitle>
                <EnhancedCardDescription>
                  Success state styling for positive actions.
                </EnhancedCardDescription>
              </EnhancedCardHeader>
              <EnhancedCardContent>
                <p className="text-sm text-muted-foreground">
                  Perfect for displaying successful operations, completed
                  tasks, or positive feedback.
                </p>
              </EnhancedCardContent>
            </EnhancedCard>

            {/* Elevated Card */}
            <EnhancedCard variant="elevated" animation="lift">
              <EnhancedCardHeader>
                <EnhancedCardTitle>Elevated Card</EnhancedCardTitle>
                <EnhancedCardDescription>
                  Enhanced shadows for depth and prominence.
                </EnhancedCardDescription>
              </EnhancedCardHeader>
              <EnhancedCardContent>
                <p className="text-sm text-muted-foreground">
                  This card has enhanced shadows and lift animations to
                  draw attention to important content.
                </p>
              </EnhancedCardContent>
            </EnhancedCard>
          </div>
        </section>

        {/* Enhanced Avatars Section */}
        <section className="space-y-6">
          <h2 className="text-2xl font-semibold text-foreground">Enhanced Avatars</h2>

          {/* Sizes */}
          <div className="space-y-4">
            <h3 className="text-lg font-medium text-muted-foreground">Sizes</h3>
            <div className="flex items-center gap-4">
              <EnhancedAvatar size="sm" fallback="XS" />
              <EnhancedAvatar size="default" fallback="DF" />
              <EnhancedAvatar size="lg" fallback="LG" />
              <EnhancedAvatar size="xl" fallback="XL" />
              <EnhancedAvatar size="2xl" fallback="2X" />
            </div>
          </div>

          {/* Variants */}
          <div className="space-y-4">
            <h3 className="text-lg font-medium text-muted-foreground">Variants</h3>
            <div className="flex items-center gap-4">
              <EnhancedAvatar variant="default" fallback="DF" />
              <EnhancedAvatar variant="neural" fallback="AI" />
              <EnhancedAvatar variant="success" fallback="OK" />
              <EnhancedAvatar variant="glass" fallback="GL" />
              <EnhancedAvatar variant="interactive" fallback="IX" />
            </div>
          </div>

          {/* Shapes */}
          <div className="space-y-4">
            <h3 className="text-lg font-medium text-muted-foreground">Shapes</h3>
            <div className="flex items-center gap-4">
              <EnhancedAvatar shape="circle" fallback="CI" />
              <EnhancedAvatar shape="square" fallback="SQ" />
              <EnhancedAvatar shape="rounded" fallback="RD" />
            </div>
          </div>

          {/* Status Indicators */}
          <div className="space-y-4">
            <h3 className="text-lg font-medium text-muted-foreground">Status Indicators</h3>
            <div className="flex items-center gap-4">
              <EnhancedAvatar
                status="online"
                showStatus
                fallback="ON"
                size="lg"
              />
              <EnhancedAvatar
                status="offline"
                showStatus
                fallback="OF"
                size="lg"
              />
              <EnhancedAvatar
                status="busy"
                showStatus
                fallback="BY"
                size="lg"
              />
              <EnhancedAvatar
                status="away"
                showStatus
                fallback="AW"
                size="lg"
              />
            </div>
          </div>
        </section>

        {/* Color Palette Demo */}
        <section className="space-y-6">
          <h2 className="text-2xl font-semibold text-foreground">OKLCH Color Palette</h2>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="space-y-2">
              <div className="h-20 bg-primary rounded-lg shadow-md"></div>
              <p className="text-sm font-medium text-center">Primary</p>
            </div>
            <div className="space-y-2">
              <div className="h-20 bg-secondary rounded-lg shadow-md"></div>
              <p className="text-sm font-medium text-center">Secondary</p>
            </div>
            <div className="space-y-2">
              <div className="h-20 bg-ingrid-neural rounded-lg shadow-md"></div>
              <p className="text-sm font-medium text-center">Neural</p>
            </div>
            <div className="space-y-2">
              <div className="h-20 bg-ingrid-success rounded-lg shadow-md"></div>
              <p className="text-sm font-medium text-center">Success</p>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
};

export default MynaUITestPage;