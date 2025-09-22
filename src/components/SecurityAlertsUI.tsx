/**
 * Security Alerts UI
 *
 * Dashboard component for displaying security alerts and monitoring
 * the "naughty list" of users with security violations.
 * Only accessible to administrators.
 */

import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useToast } from '@/hooks/use-toast';
import { usePermissions } from '@/hooks/usePermissions';
import {
  Shield,
  AlertTriangle,
  CheckCircle2,
  Clock,
  TrendingUp,
  Users,
  Activity,
  Eye,
  UserX,
  Ban,
  AlertCircle,
  RefreshCw
} from 'lucide-react';
import {
  SecurityMonitoringService,
  SecurityAlert,
  NaughtyListEntry,
  SecurityMetrics
} from '@/services/permissions/SecurityMonitoringService';

export default function SecurityAlertsUI() {
  const { toast } = useToast();
  const { canViewSecurityLogs, isSuperAdmin, isAdmin } = usePermissions();

  const [alerts, setAlerts] = useState<SecurityAlert[]>([]);
  const [naughtyList, setNaughtyList] = useState<NaughtyListEntry[]>([]);
  const [metrics, setMetrics] = useState<SecurityMetrics | null>(null);
  const [selectedAlert, setSelectedAlert] = useState<SecurityAlert | null>(null);
  const [lastRefresh, setLastRefresh] = useState<Date>(new Date());

  // Check permissions
  if (!canViewSecurityLogs) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Shield className="h-5 w-5 text-red-500" />
            Access Denied
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Alert>
            <AlertTriangle className="h-4 w-4" />
            <AlertDescription>
              You don't have permission to view security monitoring data.
              Only administrators can access this information.
            </AlertDescription>
          </Alert>
        </CardContent>
      </Card>
    );
  }

  const refreshData = () => {
    setAlerts(SecurityMonitoringService.getSecurityAlerts());
    setNaughtyList(SecurityMonitoringService.getNaughtyList());
    setMetrics(SecurityMonitoringService.getSecurityMetrics());
    setLastRefresh(new Date());
  };

  useEffect(() => {
    refreshData();

    // Auto-refresh every 30 seconds
    const interval = setInterval(refreshData, 30000);
    return () => clearInterval(interval);
  }, []);

  const handleAcknowledgeAlert = (alertId: string) => {
    SecurityMonitoringService.acknowledgeAlert(alertId, 'current_admin'); // In production, use actual admin ID
    refreshData();
    toast({
      title: "Alert Acknowledged",
      description: "The security alert has been marked as acknowledged.",
    });
  };

  const handleRemoveFromNaughtyList = (userId: string, userName: string) => {
    SecurityMonitoringService.removeFromNaughtyList(userId);
    refreshData();
    toast({
      title: "User Removed",
      description: `${userName} has been removed from the security watch list.`,
    });
  };

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case 'critical': return 'text-red-600 bg-red-100';
      case 'high': return 'text-orange-600 bg-orange-100';
      case 'medium': return 'text-yellow-600 bg-yellow-100';
      case 'low': return 'text-blue-600 bg-blue-100';
      default: return 'text-gray-600 bg-gray-100';
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'suspended': return 'text-red-600 bg-red-100';
      case 'restricted': return 'text-orange-600 bg-orange-100';
      case 'warning': return 'text-yellow-600 bg-yellow-100';
      case 'watching': return 'text-blue-600 bg-blue-100';
      default: return 'text-gray-600 bg-gray-100';
    }
  };

  const activeAlerts = alerts.filter(alert => !alert.acknowledged);
  const criticalAlerts = alerts.filter(alert => alert.severity === 'critical' && !alert.acknowledged);

  return (
    <div className="space-y-6">
      {/* Header with refresh */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Security Monitoring</h2>
          <p className="text-muted-foreground">
            Monitor security alerts and user activities
          </p>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-sm text-muted-foreground">
            Last updated: {lastRefresh.toLocaleTimeString()}
          </span>
          <Button variant="outline" size="sm" onClick={refreshData}>
            <RefreshCw className="h-4 w-4 mr-2" />
            Refresh
          </Button>
        </div>
      </div>

      {/* Critical Alerts Banner */}
      {criticalAlerts.length > 0 && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            <strong>{criticalAlerts.length} critical security alert{criticalAlerts.length > 1 ? 's' : ''} require immediate attention!</strong>
          </AlertDescription>
        </Alert>
      )}

      {/* Metrics Overview */}
      {metrics && (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-2">
                <AlertTriangle className="h-4 w-4 text-orange-500" />
                <div>
                  <p className="text-sm font-medium">Active Alerts</p>
                  <p className="text-2xl font-bold">{metrics.activeAlerts}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-2">
                <Shield className="h-4 w-4 text-red-500" />
                <div>
                  <p className="text-sm font-medium">High Priority</p>
                  <p className="text-2xl font-bold">{metrics.highSeverityAlerts}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-2">
                <UserX className="h-4 w-4 text-yellow-500" />
                <div>
                  <p className="text-sm font-medium">Watch List</p>
                  <p className="text-2xl font-bold">{metrics.usersOnNaughtyList}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-2">
                <TrendingUp className="h-4 w-4 text-blue-500" />
                <div>
                  <p className="text-sm font-medium">24h Trends</p>
                  <p className="text-2xl font-bold">{metrics.alertTrends.last24Hours}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Main Content Tabs */}
      <Tabs defaultValue="alerts" className="w-full">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="alerts" className="flex items-center gap-2">
            <AlertTriangle className="h-4 w-4" />
            Security Alerts
            {activeAlerts.length > 0 && (
              <Badge variant="destructive" className="ml-1">
                {activeAlerts.length}
              </Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="naughty-list" className="flex items-center gap-2">
            <UserX className="h-4 w-4" />
            Watch List
            {naughtyList.length > 0 && (
              <Badge variant="secondary" className="ml-1">
                {naughtyList.length}
              </Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="analytics" className="flex items-center gap-2">
            <Activity className="h-4 w-4" />
            Analytics
          </TabsTrigger>
        </TabsList>

        {/* Security Alerts Tab */}
        <TabsContent value="alerts" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Recent Security Alerts</CardTitle>
              <CardDescription>
                Security events requiring attention from administrators
              </CardDescription>
            </CardHeader>
            <CardContent>
              {alerts.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <Shield className="h-12 w-12 mx-auto mb-4 opacity-50" />
                  <p>No security alerts at this time</p>
                  <p className="text-sm">All systems are operating normally</p>
                </div>
              ) : (
                <ScrollArea className="h-96">
                  <div className="space-y-3">
                    {alerts
                      .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
                      .map((alert) => (
                        <div
                          key={alert.id}
                          className={`p-4 border rounded-lg cursor-pointer transition-colors ${
                            alert.acknowledged ? 'bg-gray-50' : 'bg-white hover:bg-gray-50'
                          }`}
                          onClick={() => setSelectedAlert(alert)}
                        >
                          <div className="flex items-start justify-between">
                            <div className="flex-1">
                              <div className="flex items-center gap-2 mb-2">
                                <Badge className={getSeverityColor(alert.severity)}>
                                  {alert.severity.toUpperCase()}
                                </Badge>
                                <Badge variant="outline">{alert.type.replace('_', ' ')}</Badge>
                                {alert.acknowledged && (
                                  <CheckCircle2 className="h-4 w-4 text-green-500" />
                                )}
                              </div>
                              <h4 className="font-medium">{alert.title}</h4>
                              <p className="text-sm text-muted-foreground mb-2">
                                {alert.description}
                              </p>
                              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                                <Clock className="h-3 w-3" />
                                {new Date(alert.timestamp).toLocaleString()}
                                <span>•</span>
                                <span>User: {alert.userName}</span>
                              </div>
                            </div>
                            <div className="flex gap-2">
                              {!alert.acknowledged && (
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleAcknowledgeAlert(alert.id);
                                  }}
                                >
                                  <CheckCircle2 className="h-3 w-3 mr-1" />
                                  Acknowledge
                                </Button>
                              )}
                              <Button size="sm" variant="ghost">
                                <Eye className="h-3 w-3" />
                              </Button>
                            </div>
                          </div>
                        </div>
                      ))}
                  </div>
                </ScrollArea>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Naughty List Tab */}
        <TabsContent value="naughty-list" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Security Watch List</CardTitle>
              <CardDescription>
                Users who have triggered security alerts or violated access policies
              </CardDescription>
            </CardHeader>
            <CardContent>
              {naughtyList.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <Users className="h-12 w-12 mx-auto mb-4 opacity-50" />
                  <p>No users on watch list</p>
                  <p className="text-sm">All users are behaving normally</p>
                </div>
              ) : (
                <ScrollArea className="h-96">
                  <div className="space-y-3">
                    {naughtyList
                      .sort((a, b) => b.riskScore - a.riskScore)
                      .map((entry) => (
                        <div key={entry.userId} className="p-4 border rounded-lg">
                          <div className="flex items-start justify-between">
                            <div className="flex-1">
                              <div className="flex items-center gap-2 mb-2">
                                <Badge className={getStatusColor(entry.status)}>
                                  {entry.status.toUpperCase()}
                                </Badge>
                                <span className="text-sm text-muted-foreground">
                                  Risk Score: {entry.riskScore.toFixed(1)}
                                </span>
                              </div>
                              <h4 className="font-medium">{entry.userName}</h4>
                              <div className="text-sm text-muted-foreground space-y-1">
                                <p>Total Violations: {entry.totalViolations}</p>
                                <p>Recent Violations: {entry.recentViolations}</p>
                                <p>Last Violation: {new Date(entry.lastViolation).toLocaleString()}</p>
                                <p>Added: {new Date(entry.addedAt).toLocaleDateString()}</p>
                              </div>
                              {entry.notes.length > 0 && (
                                <div className="mt-2">
                                  <p className="text-xs font-medium">Recent Activity:</p>
                                  <p className="text-xs text-muted-foreground">
                                    {entry.notes[entry.notes.length - 1]}
                                  </p>
                                </div>
                              )}
                            </div>
                            <div className="flex gap-2">
                              {isSuperAdmin && (
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={() => handleRemoveFromNaughtyList(entry.userId, entry.userName)}
                                >
                                  <Ban className="h-3 w-3 mr-1" />
                                  Remove
                                </Button>
                              )}
                              <Button size="sm" variant="ghost">
                                <Eye className="h-3 w-3" />
                              </Button>
                            </div>
                          </div>
                        </div>
                      ))}
                  </div>
                </ScrollArea>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Analytics Tab */}
        <TabsContent value="analytics" className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Card>
              <CardHeader>
                <CardTitle>Alert Trends</CardTitle>
              </CardHeader>
              <CardContent>
                {metrics && (
                  <div className="space-y-3">
                    <div className="flex justify-between">
                      <span>Last 24 Hours:</span>
                      <Badge>{metrics.alertTrends.last24Hours}</Badge>
                    </div>
                    <div className="flex justify-between">
                      <span>Last 7 Days:</span>
                      <Badge>{metrics.alertTrends.last7Days}</Badge>
                    </div>
                    <div className="flex justify-between">
                      <span>Last 30 Days:</span>
                      <Badge>{metrics.alertTrends.last30Days}</Badge>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Alert Types</CardTitle>
              </CardHeader>
              <CardContent>
                {metrics && (
                  <div className="space-y-3">
                    {Object.entries(metrics.alertsByType).map(([type, count]) => (
                      <div key={type} className="flex justify-between">
                        <span className="capitalize">{type.replace('_', ' ')}:</span>
                        <Badge variant="outline">{count}</Badge>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}