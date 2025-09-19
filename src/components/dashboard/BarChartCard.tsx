"use client";

import DashboardCard from "./DashboardCard.tsx";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import { formatCurrency } from "@/lib/utils";
import { useEffect, useState } from "react";

interface BarChartCardProps {
  title: string;
  description?: string;
  data: any[];
  dataKey: string; // Key for the bar value (e.g., 'amount', 'spend', 'sales')
  categoryKey: string; // Key for the X-axis (e.g., 'name', 'vendor', 'customer')
  currencyCode?: string; // Optional currency code for Y-axis formatting
  isLoading?: boolean;
}

const BarChartCard = ({ title, description, data, dataKey, categoryKey, currencyCode = "USD", isLoading }: BarChartCardProps) => {
  const [formattedData, setFormattedData] = useState<any[]>([]);

  useEffect(() => {
    const formatValues = async () => {
      const newFormattedData = await Promise.all(
        data.map(async (item) => ({
          ...item,
          [dataKey]: item[dataKey], // Keep raw number for chart
          [`${dataKey}Formatted`]: await formatCurrency(item[dataKey], currencyCode), // Formatted for tooltip
        }))
      );
      setFormattedData(newFormattedData);
    };
    formatValues();
  }, [data, dataKey, currencyCode]);

  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload?.length) {
      const value = payload[0].payload[`${dataKey}Formatted`];
      return (
        <div className="rounded-lg border bg-background p-2 text-sm shadow-sm">
          <div className="grid grid-cols-2 gap-2">
            <div className="text-muted-foreground">{categoryKey}:</div>
            <div>{label}</div>
            <div className="text-muted-foreground">{dataKey}:</div>
            <div>{value}</div>
          </div>
        </div>
      );
    }
    return null;
  };

  return (
    <DashboardCard title={title} description={description} isLoading={isLoading}>
      {formattedData.length > 0 ? (
        <ResponsiveContainer width="100%" height={250}>
          <BarChart data={formattedData} margin={{ top: 5, right: 10, left: 10, bottom: 5 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--muted))" />
            <XAxis dataKey={categoryKey} stroke="hsl(var(--foreground))" fontSize={12} tickLine={false} axisLine={false} />
            <YAxis stroke="hsl(var(--foreground))" fontSize={12} tickLine={false} axisLine={false} tickFormatter={(value) => value.toLocaleString('en-US', { maximumFractionDigits: 0 })} />
            <Tooltip content={<CustomTooltip />} />
            <Bar dataKey={dataKey} fill="hsl(var(--brand-accent))" radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      ) : (
        <p className="text-muted-foreground">No data available.</p>
      )}
    </DashboardCard>
  );
};

export default BarChartCard;