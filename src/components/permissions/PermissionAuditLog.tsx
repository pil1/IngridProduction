/**
 * Permission Audit Log Component
 *
 * Displays comprehensive audit trail of all permission changes,
 * access attempts, and security events.
 */

import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import {
  Calendar,
  Filter,
  Search,
  Download,
  Eye,
  Shield,
  User,
  Users,
  Settings,
  AlertTriangle,
  CheckCircle,
  XCircle,
  Clock,
  Key,
  Lock,
  Unlock
} from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { formatDistanceToNow } from 'date-fns';

interface AuditLogEntry {
  id: string;
  user_id: string;
  user_email: string;
  user_name: string;
  action_type: 'permission_granted' | 'permission_revoked' | 'permission_checked' | 'module_enabled' | 'module_disabled' | 'role_changed' | 'access_denied' | 'login_success' | 'login_failed';
  resource: string;
  resource_id: string | null;
  target_user_id: string | null;
  target_user_email: string | null;
  company_id: string;
  company_name: string;
  details: Record<string, any>;
  ip_address: string | null;
  user_agent: string | null;
  risk_score: number;
  created_at: string;
}

const actionTypeConfig = {
  permission_granted: {
    icon: Unlock,
    color: 'text-green-600 bg-green-100',
    label: 'Permission Granted',
  },
  permission_revoked: {
    icon: Lock,
    color: 'text-red-600 bg-red-100',
    label: 'Permission Revoked',
  },
  permission_checked: {
    icon: Eye,
    color: 'text-blue-600 bg-blue-100',
    label: 'Permission Checked',
  },
  module_enabled: {
    icon: CheckCircle,
    color: 'text-green-600 bg-green-100',
    label: 'Module Enabled',
  },
  module_disabled: {
    icon: XCircle,
    color: 'text-red-600 bg-red-100',
    label: 'Module Disabled',
  },
  role_changed: {
    icon: Shield,
    color: 'text-purple-600 bg-purple-100',
    label: 'Role Changed',
  },
  access_denied: {
    icon: AlertTriangle,
    color: 'text-red-600 bg-red-100',
    label: 'Access Denied',
  },
  login_success: {
    icon: CheckCircle,
    color: 'text-green-600 bg-green-100',
    label: 'Login Success',
  },
  login_failed: {
    icon: XCircle,
    color: 'text-red-600 bg-red-100',
    label: 'Login Failed',
  },
} as const;

const riskLevelConfig = {
  low: { color: 'text-green-600 bg-green-100', label: 'Low' },
  medium: { color: 'text-yellow-600 bg-yellow-100', label: 'Medium' },
  high: { color: 'text-red-600 bg-red-100', label: 'High' },
} as const;

export const PermissionAuditLog: React.FC = () => {
  const [searchTerm, setSearchTerm] = useState('');
  const [actionFilter, setActionFilter] = useState<string>('all');
  const [riskFilter, setRiskFilter] = useState<string>('all');
  const [dateRange, setDateRange] = useState<string>('7d');
  const [selectedEntry, setSelectedEntry] = useState<AuditLogEntry | null>(null);

  // Generate mock audit log data (in production, this would come from your audit system)
  const { data: auditEntries, isLoading } = useQuery({
    queryKey: ['auditLog', searchTerm, actionFilter, riskFilter, dateRange],
    queryFn: async (): Promise<AuditLogEntry[]> => {
      // This would be replaced with actual audit log API calls
      const mockEntries: AuditLogEntry[] = [
        {
          id: '1',
          user_id: 'user1',
          user_email: 'admin@example.com',
          user_name: 'John Admin',
          action_type: 'permission_granted',
          resource: 'expenses.approve',
          resource_id: 'perm1',
          target_user_id: 'user2',
          target_user_email: 'user@example.com',
          company_id: 'company1',
          company_name: 'Acme Corp',
          details: {
            permission: 'expenses.approve',
            granted_by: 'John Admin',
            reason: 'Promotion to manager role',
          },
          ip_address: '192.168.1.100',
          user_agent: 'Mozilla/5.0...',
          risk_score: 2,
          created_at: new Date(Date.now() - 1000 * 60 * 30).toISOString(), // 30 minutes ago
        },
        {
          id: '2',
          user_id: 'user2',
          user_email: 'user@example.com',
          user_name: 'Jane User',
          action_type: 'access_denied',
          resource: 'gl_accounts.view',
          resource_id: null,
          target_user_id: null,
          target_user_email: null,
          company_id: 'company1',
          company_name: 'Acme Corp',
          details: {
            attempted_resource: '/gl-accounts',
            required_permission: 'gl_accounts.view',
            user_role: 'user',
          },
          ip_address: '192.168.1.101',
          user_agent: 'Mozilla/5.0...',
          risk_score: 5,
          created_at: new Date(Date.now() - 1000 * 60 * 60 * 2).toISOString(), // 2 hours ago
        },
        {
          id: '3',
          user_id: 'user1',
          user_email: 'admin@example.com',
          user_name: 'John Admin',
          action_type: 'module_enabled',
          resource: 'Ingrid AI',
          resource_id: 'module1',
          target_user_id: null,
          target_user_email: null,
          company_id: 'company1',
          company_name: 'Acme Corp',
          details: {
            module: 'Ingrid AI',
            billing_tier: 'premium',
            configuration: { auto_categorization: true },
          },
          ip_address: '192.168.1.100',
          user_agent: 'Mozilla/5.0...',
          risk_score: 1,
          created_at: new Date(Date.now() - 1000 * 60 * 60 * 24).toISOString(), // 1 day ago
        },
        {
          id: '4',
          user_id: 'user3',
          user_email: 'suspicious@external.com',
          user_name: 'Suspicious User',
          action_type: 'login_failed',
          resource: 'authentication',
          resource_id: null,
          target_user_id: null,
          target_user_email: null,
          company_id: 'company1',
          company_name: 'Acme Corp',
          details: {
            failure_reason: 'Invalid password',
            attempt_count: 5,
            locked_account: true,
          },
          ip_address: '203.0.113.1',
          user_agent: 'curl/7.68.0',
          risk_score: 9,
          created_at: new Date(Date.now() - 1000 * 60 * 60 * 3).toISOString(), // 3 hours ago
        },
        {
          id: '5',
          user_id: 'user1',
          user_email: 'admin@example.com',
          user_name: 'John Admin',
          action_type: 'role_changed',
          resource: 'user_role',
          resource_id: 'user2',
          target_user_id: 'user2',
          target_user_email: 'user@example.com',
          company_id: 'company1',
          company_name: 'Acme Corp',
          details: {
            previous_role: 'user',
            new_role: 'admin',
            reason: 'Department restructure',
          },
          ip_address: '192.168.1.100',
          user_agent: 'Mozilla/5.0...',
          risk_score: 3,
          created_at: new Date(Date.now() - 1000 * 60 * 60 * 6).toISOString(), // 6 hours ago
        },
      ];

      // Apply filters
      let filtered = mockEntries;

      if (searchTerm) {
        const searchLower = searchTerm.toLowerCase();
        filtered = filtered.filter(entry =>
          entry.user_email.toLowerCase().includes(searchLower) ||
          entry.user_name.toLowerCase().includes(searchLower) ||
          entry.resource.toLowerCase().includes(searchLower) ||
          entry.company_name.toLowerCase().includes(searchLower)
        );
      }

      if (actionFilter !== 'all') {
        filtered = filtered.filter(entry => entry.action_type === actionFilter);
      }

      if (riskFilter !== 'all') {
        filtered = filtered.filter(entry => {
          const riskLevel = entry.risk_score >= 7 ? 'high' : entry.risk_score >= 4 ? 'medium' : 'low';
          return riskLevel === riskFilter;
        });
      }

      // Apply date range filter
      const now = new Date();
      const cutoff = new Date();
      switch (dateRange) {
        case '1d':
          cutoff.setDate(now.getDate() - 1);
          break;
        case '7d':
          cutoff.setDate(now.getDate() - 7);
          break;
        case '30d':
          cutoff.setDate(now.getDate() - 30);
          break;
        case '90d':
          cutoff.setDate(now.getDate() - 90);
          break;
      }

      if (dateRange !== 'all') {
        filtered = filtered.filter(entry => new Date(entry.created_at) >= cutoff);
      }

      return filtered.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
    },
    staleTime: 1000 * 60 * 2, // Cache for 2 minutes
  });

  const getRiskLevel = (score: number): keyof typeof riskLevelConfig => {
    if (score >= 7) return 'high';
    if (score >= 4) return 'medium';
    return 'low';
  };

  const exportAuditLog = () => {
    // Implementation for exporting audit log
    console.log('Exporting audit log...');
  };

  if (isLoading) {
    return (
      <div className="space-y-4">
        {[...Array(10)].map((_, i) => (
          <div key={i} className="h-16 bg-gray-100 rounded animate-pulse" />
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Filters and Controls */}
      <Card className="p-4">
        <div className="flex flex-col lg:flex-row gap-4 items-center justify-between">
          <div className="flex flex-col sm:flex-row gap-4 flex-1">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
              <Input
                placeholder="Search users, resources, or companies..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10 w-full sm:w-64"
              />
            </div>

            <Select value={actionFilter} onValueChange={setActionFilter}>
              <SelectTrigger className="w-full sm:w-48">
                <SelectValue placeholder="Filter by action" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Actions</SelectItem>
                {Object.entries(actionTypeConfig).map(([key, config]) => (
                  <SelectItem key={key} value={key}>
                    {config.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select value={riskFilter} onValueChange={setRiskFilter}>
              <SelectTrigger className="w-full sm:w-48">
                <SelectValue placeholder="Filter by risk" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Risk Levels</SelectItem>
                <SelectItem value="low">Low Risk</SelectItem>
                <SelectItem value="medium">Medium Risk</SelectItem>
                <SelectItem value="high">High Risk</SelectItem>
              </SelectContent>
            </Select>

            <Select value={dateRange} onValueChange={setDateRange}>
              <SelectTrigger className="w-full sm:w-48">
                <SelectValue placeholder="Date range" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="1d">Last 24 hours</SelectItem>
                <SelectItem value="7d">Last 7 days</SelectItem>
                <SelectItem value="30d">Last 30 days</SelectItem>
                <SelectItem value="90d">Last 90 days</SelectItem>
                <SelectItem value="all">All time</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <Button onClick={exportAuditLog} className="flex items-center gap-2">
            <Download className="h-4 w-4" />
            Export Log
          </Button>
        </div>
      </Card>

      {/* Summary Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card className="p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-blue-100 rounded-lg">
              <Eye className="h-5 w-5 text-blue-600" />
            </div>
            <div>
              <p className="text-sm text-gray-600">Total Events</p>
              <p className="text-xl font-semibold">{auditEntries?.length || 0}</p>
            </div>
          </div>
        </Card>

        <Card className="p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-red-100 rounded-lg">
              <AlertTriangle className="h-5 w-5 text-red-600" />
            </div>
            <div>
              <p className="text-sm text-gray-600">High Risk Events</p>
              <p className="text-xl font-semibold">
                {auditEntries?.filter(e => e.risk_score >= 7).length || 0}
              </p>
            </div>
          </div>
        </Card>

        <Card className="p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-green-100 rounded-lg">
              <CheckCircle className="h-5 w-5 text-green-600" />
            </div>
            <div>
              <p className="text-sm text-gray-600">Permission Changes</p>
              <p className="text-xl font-semibold">
                {auditEntries?.filter(e => e.action_type.includes('permission')).length || 0}
              </p>
            </div>
          </div>
        </Card>

        <Card className="p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-purple-100 rounded-lg">
              <Users className="h-5 w-5 text-purple-600" />
            </div>
            <div>
              <p className="text-sm text-gray-600">Unique Users</p>
              <p className="text-xl font-semibold">
                {new Set(auditEntries?.map(e => e.user_id)).size || 0}
              </p>
            </div>
          </div>
        </Card>
      </div>

      {/* Audit Log Table */}
      <Card>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Timestamp</TableHead>
              <TableHead>User</TableHead>
              <TableHead>Action</TableHead>
              <TableHead>Resource</TableHead>
              <TableHead>Target</TableHead>
              <TableHead>Risk Level</TableHead>
              <TableHead>IP Address</TableHead>
              <TableHead className="w-12"></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {auditEntries?.map((entry) => {
              const ActionIcon = actionTypeConfig[entry.action_type].icon;
              const riskLevel = getRiskLevel(entry.risk_score);

              return (
                <TableRow key={entry.id}>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <Clock className="h-4 w-4 text-gray-400" />
                      <div>
                        <div className="text-sm font-medium">
                          {formatDistanceToNow(new Date(entry.created_at), { addSuffix: true })}
                        </div>
                        <div className="text-xs text-gray-500">
                          {new Date(entry.created_at).toLocaleString()}
                        </div>
                      </div>
                    </div>
                  </TableCell>

                  <TableCell>
                    <div>
                      <div className="font-medium">{entry.user_name}</div>
                      <div className="text-sm text-gray-500">{entry.user_email}</div>
                    </div>
                  </TableCell>

                  <TableCell>
                    <div className="flex items-center gap-2">
                      <div className={`p-1 rounded ${actionTypeConfig[entry.action_type].color}`}>
                        <ActionIcon className="h-3 w-3" />
                      </div>
                      <span className="text-sm font-medium">
                        {actionTypeConfig[entry.action_type].label}
                      </span>
                    </div>
                  </TableCell>

                  <TableCell>
                    <div>
                      <div className="font-medium">{entry.resource}</div>
                      <div className="text-sm text-gray-500">{entry.company_name}</div>
                    </div>
                  </TableCell>

                  <TableCell>
                    {entry.target_user_email ? (
                      <div>
                        <div className="text-sm font-medium">{entry.target_user_email}</div>
                        <div className="text-xs text-gray-500">Target User</div>
                      </div>
                    ) : (
                      <span className="text-gray-400">-</span>
                    )}
                  </TableCell>

                  <TableCell>
                    <Badge className={riskLevelConfig[riskLevel].color}>
                      {riskLevelConfig[riskLevel].label}
                    </Badge>
                  </TableCell>

                  <TableCell>
                    <code className="text-xs bg-gray-100 px-2 py-1 rounded">
                      {entry.ip_address || 'Unknown'}
                    </code>
                  </TableCell>

                  <TableCell>
                    <Dialog>
                      <DialogTrigger asChild>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => setSelectedEntry(entry)}
                        >
                          <Eye className="h-4 w-4" />
                        </Button>
                      </DialogTrigger>
                      <DialogContent className="max-w-2xl">
                        <DialogHeader>
                          <DialogTitle>Audit Log Entry Details</DialogTitle>
                        </DialogHeader>

                        {selectedEntry && (
                          <div className="space-y-6">
                            <div className="grid grid-cols-2 gap-4">
                              <div>
                                <label className="text-sm font-medium text-gray-500">User</label>
                                <p className="mt-1">{selectedEntry.user_name} ({selectedEntry.user_email})</p>
                              </div>
                              <div>
                                <label className="text-sm font-medium text-gray-500">Company</label>
                                <p className="mt-1">{selectedEntry.company_name}</p>
                              </div>
                              <div>
                                <label className="text-sm font-medium text-gray-500">Action</label>
                                <p className="mt-1">{actionTypeConfig[selectedEntry.action_type].label}</p>
                              </div>
                              <div>
                                <label className="text-sm font-medium text-gray-500">Resource</label>
                                <p className="mt-1">{selectedEntry.resource}</p>
                              </div>
                              <div>
                                <label className="text-sm font-medium text-gray-500">Risk Score</label>
                                <p className="mt-1">
                                  {selectedEntry.risk_score}/10
                                  <Badge className={`ml-2 ${riskLevelConfig[getRiskLevel(selectedEntry.risk_score)].color}`}>
                                    {riskLevelConfig[getRiskLevel(selectedEntry.risk_score)].label}
                                  </Badge>
                                </p>
                              </div>
                              <div>
                                <label className="text-sm font-medium text-gray-500">IP Address</label>
                                <p className="mt-1">{selectedEntry.ip_address || 'Unknown'}</p>
                              </div>
                            </div>

                            <div>
                              <label className="text-sm font-medium text-gray-500">Event Details</label>
                              <pre className="mt-1 p-3 bg-gray-100 rounded text-sm overflow-auto">
                                {JSON.stringify(selectedEntry.details, null, 2)}
                              </pre>
                            </div>

                            {selectedEntry.user_agent && (
                              <div>
                                <label className="text-sm font-medium text-gray-500">User Agent</label>
                                <p className="mt-1 text-sm text-gray-600 break-all">
                                  {selectedEntry.user_agent}
                                </p>
                              </div>
                            )}
                          </div>
                        )}
                      </DialogContent>
                    </Dialog>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </Card>

      {auditEntries?.length === 0 && (
        <Card className="p-8 text-center">
          <Calendar className="h-12 w-12 text-gray-400 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-900 mb-2">No audit entries found</h3>
          <p className="text-gray-500">
            No events match your current filters. Try adjusting the search criteria or date range.
          </p>
        </Card>
      )}
    </div>
  );
};