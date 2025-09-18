"use client";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { Loader2 } from "lucide-react";
import React from "react";

interface DashboardCardProps extends React.ComponentProps<typeof Card> {
  title: string;
  description?: string;
  isLoading?: boolean;
  children: React.ReactNode;
}

const DashboardCard = ({ title, description, isLoading = false, children, className, ...props }: DashboardCardProps) => {
  return (
    <Card className={cn("flex flex-col", className)} {...props}>
      <CardHeader className="pb-2">
        <CardTitle className="text-lg">{title}</CardTitle>
        {description && <CardDescription>{description}</CardDescription>}
      </CardHeader>
      <CardContent className="flex-1 flex items-center justify-center p-4">
        {isLoading ? (
          <div className="flex flex-col items-center gap-2 text-muted-foreground">
            <Loader2 className="h-6 w-6 animate-spin" />
            <p>Loading data...</p>
          </div>
        ) : (
          children
        )}
      </CardContent>
    </Card>
  );
};

export default DashboardCard;