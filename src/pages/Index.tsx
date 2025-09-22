"use client";

import { Loader2, Search, Zap, TrendingUp, Shield, FileText, Users, Sparkles, Brain } from "lucide-react";
import { useSession } from "@/components/SessionContextProvider";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useNavigate } from "react-router-dom";
import { ComponentHealthCheck, ErrorBoundary } from "@/components/DiagnosticTools";

const Index = () => {
  const { isLoading, profile } = useSession();
  const navigate = useNavigate();

  if (isLoading) {
    return (
      <div className="flex flex-1 items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin" />
        <p className="ml-2">Loading dashboard...</p>
      </div>
    );
  }

  const features = [
    {
      icon: Sparkles,
      title: "Ingrid AI Assistant",
      description: "Revolutionary conversational AI that processes any document type with intelligent workflow suggestions.",
      href: "/ingrid-ai",
      badge: "🔥 Phase 4",
      color: "text-blue-600",
      spotlight: true,
    },
    {
      icon: Search,
      title: "Advanced Search & Filtering",
      description: "Powerful search capabilities with smart filters and quick presets for finding expenses instantly.",
      href: "/enhanced-expenses",
      badge: "New",
      color: "text-blue-500",
    },
    {
      icon: Zap,
      title: "Performance Optimized",
      description: "Lazy loading, virtualized tables, and optimized hooks for lightning-fast performance.",
      href: "/expenses",
      badge: "Enhanced",
      color: "text-green-500",
    },
    {
      icon: TrendingUp,
      title: "Analytics Dashboard",
      description: "Real-time insights with interactive charts and comprehensive expense analytics.",
      href: "/dashboard",
      badge: "Pro",
      color: "text-purple-500",
    },
    {
      icon: Brain,
      title: "AI Analytics",
      description: "Advanced AI performance metrics, confidence tracking, and efficiency insights for administrators.",
      href: "/analytics",
      badge: "🤖 New",
      color: "text-blue-600",
      spotlight: true,
      adminOnly: true,
    },
    {
      icon: Shield,
      title: "Type-Safe Codebase",
      description: "Fully TypeScript with proper error handling and modern code quality standards.",
      href: "/",
      badge: "Quality",
      color: "text-orange-500",
    },
    {
      icon: FileText,
      title: "Smart Automation",
      description: "AI-powered document processing and automated workflow management.",
      href: "/company-settings?tab=automations",
      badge: "AI",
      color: "text-cyan-500",
    },
    {
      icon: Users,
      title: "Multi-Tenant Ready",
      description: "Complete user management with role-based access control and company isolation.",
      href: "/users",
      badge: "Enterprise",
      color: "text-indigo-500",
    },
    {
      icon: Shield,
      title: "Permissions Management",
      description: "Comprehensive interface for managing user permissions, module access, and role configurations.",
      href: "/permissions",
      badge: "🔐 Admin",
      color: "text-purple-600",
      adminOnly: true,
    },
  ];

  // Default content for users with a company or super-admins who have set up companies
  return (
    <div className="space-y-8 p-6">
      <div className="text-center space-y-4">
        <h1 className="text-4xl font-bold tracking-tight">
          Welcome to INFOtrac!
        </h1>
        <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
          Your comprehensive expense management and business automation platform.
          Explore the enhanced features and capabilities below.
        </p>
        {profile && (
          <div className="flex items-center justify-center gap-2 text-sm text-muted-foreground">
            <span>Welcome back,</span>
            <Badge variant="secondary">{profile.full_name ?? profile.email}</Badge>
            <span>•</span>
            <Badge variant="outline">{profile.role}</Badge>
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {features
          .filter(feature => {
            // Show admin-only features only to admins, controllers, and super-admins
            if (feature.adminOnly) {
              return profile?.role && ['admin', 'controller', 'super-admin'].includes(profile.role);
            }
            return true;
          })
          .map((feature, index) => {
            const Icon = feature.icon;
            return (
              <Card key={index} className={`hover:shadow-lg transition-shadow cursor-pointer group ${
                feature.spotlight ? 'ring-2 ring-blue-500 bg-gradient-to-br from-blue-50 to-purple-50' : ''
              }`} onClick={() => navigate(feature.href)}>
                <CardHeader className="space-y-2">
                  <div className="flex items-center justify-between">
                    <Icon className={`h-8 w-8 ${feature.color} group-hover:scale-110 transition-transform`} />
                    <Badge variant="secondary" className="text-xs">
                      {feature.badge}
                    </Badge>
                  </div>
                  <CardTitle className="text-lg">{feature.title}</CardTitle>
                </CardHeader>
                <CardContent>
                  <CardDescription className="text-sm leading-relaxed">
                    {feature.description}
                  </CardDescription>
                  <Button variant="ghost" size="sm" className="mt-3 p-0 h-auto font-medium text-primary">
                    Explore →
                  </Button>
                </CardContent>
              </Card>
            );
          })}
      </div>

      {/* Diagnostic Section */}
      <ErrorBoundary>
        <ComponentHealthCheck />
      </ErrorBoundary>

      <div className="text-center space-y-4 pt-8 border-t">
        <h2 className="text-2xl font-semibold">Quick Actions</h2>
        <div className="flex flex-wrap justify-center gap-3">
          <Button onClick={() => navigate("/expenses")}>
            <FileText className="h-4 w-4 mr-2" />
            View Expenses
          </Button>
          <Button variant="outline" onClick={() => navigate("/dashboard")}>
            <TrendingUp className="h-4 w-4 mr-2" />
            Analytics
          </Button>
          <Button variant="outline" onClick={() => navigate("/users")}>
            <Users className="h-4 w-4 mr-2" />
            Manage Users
          </Button>
        </div>
        <p className="text-sm text-muted-foreground">
          Select a module from the sidebar or use these quick actions to navigate the platform.
        </p>
      </div>
    </div>
  );
};

export default Index;