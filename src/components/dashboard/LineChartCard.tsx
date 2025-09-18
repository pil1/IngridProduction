"use client";

import DashboardCard from "./DashboardCard.tsx";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import { formatCurrency } from "@/lib/utils";
import { useEffect, useState } from "react";

interface LineChartCardProps {
  title: string;
  description?: string;
  data: any[];
  dataKey: string; // Key for the line value (e.g., 'expenses', 'revenue')
  categoryKey: string; // Key for the X-axis (e.g., 'month')
  currencyCode?: string; // Optional currency code for Y-axis formatting
  isLoading?: boolean;
}

const LineChartCard = ({ title, description, data, dataKey, categoryKey, currencyCode = "USD", isLoading }: LineChartCardProps) => {
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
    if (active && payload && payload.length) {
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
          <LineChart data={formattedData} margin={{ top: 5, right: 10, left: 10, bottom: 5 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--muted))" />
            <XAxis dataKey={categoryKey} stroke="hsl(var(--foreground))" fontSize={12} tickLine={false} axisLine={false} />
            <YAxis stroke="hsl(var(--foreground))" fontSize={12} tickLine={false} axisLine={false} tickFormatter={(value) => value.toLocaleString('en-US', { maximumFractionDigits: 0 })} />
            <Tooltip content={<CustomTooltip />} />
            <Line type="monotone" dataKey={dataKey} stroke="hsl(var(--brand-accent))" strokeWidth={2} dot={{ r: 4 }} activeDot={{ r: 6 }} />
          </LineChart>
        </ResponsiveContainer>
      ) : (
        <p className="text-muted-foreground">No data available.</p>
      )}
    </DashboardCard>
  );
};

export default LineChartCard;