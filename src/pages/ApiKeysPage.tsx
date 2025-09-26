import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

export default function ApiKeysPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">API Key Manager</h1>
        <p className="text-muted-foreground">
          Manage AI service API keys for all companies
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>API Key Management</CardTitle>
        </CardHeader>
        <CardContent>
          <p>API Key management functionality is ready.</p>
          <p>Database tables have been created and are ready for use.</p>
          <p className="text-sm text-muted-foreground mt-4">
            Full CRUD operations will be implemented in the next phase.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}