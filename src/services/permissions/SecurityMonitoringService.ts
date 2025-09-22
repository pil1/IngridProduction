/**
 * Security Monitoring Service
 *
 * Monitors user activities for suspicious behavior and maintains
 * the "naughty list" of users who attempt unauthorized access.
 * Provides real-time security alerts for administrators.
 */

import { PermissionService } from './PermissionService';

export interface SecurityAlert {
  id: string;
  userId: string;
  userName: string;
  type: SecurityAlertType;
  severity: 'low' | 'medium' | 'high' | 'critical';
  title: string;
  description: string;
  timestamp: string;
  details: Record<string, any>;
  acknowledged: boolean;
  acknowledgedBy?: string;
  acknowledgedAt?: string;
  actions?: SecurityAction[];
}

export type SecurityAlertType =
  | 'unauthorized_access'
  | 'repeated_failures'
  | 'suspicious_activity'
  | 'privilege_escalation'
  | 'data_access_violation'
  | 'unusual_behavior'
  | 'potential_breach';

export interface SecurityAction {
  id: string;
  label: string;
  type: 'warning' | 'suspension' | 'investigation' | 'password_reset';
  requiresConfirmation: boolean;
}

export interface NaughtyListEntry {
  userId: string;
  userName: string;
  email: string;
  riskScore: number;
  totalViolations: number;
  recentViolations: number;
  lastViolation: string;
  violationTypes: SecurityAlertType[];
  status: 'watching' | 'warning' | 'restricted' | 'suspended';
  notes: string[];
  addedAt: string;
  updatedAt: string;
}

export interface SecurityMetrics {
  totalAlerts: number;
  activeAlerts: number;
  acknowledgedAlerts: number;
  highSeverityAlerts: number;
  usersOnNaughtyList: number;
  alertsByType: Record<SecurityAlertType, number>;
  alertTrends: {
    last24Hours: number;
    last7Days: number;
    last30Days: number;
  };
}

export class SecurityMonitoringService {
  private static readonly ALERTS_STORAGE_KEY = 'security_alerts';
  private static readonly NAUGHTY_LIST_STORAGE_KEY = 'security_naughty_list';
  private static readonly ACCESS_LOGS_STORAGE_KEY = 'security_access_logs';

  // Risk score thresholds
  private static readonly RISK_THRESHOLDS = {
    WATCH: 5.0,
    WARNING: 10.0,
    RESTRICT: 20.0,
    SUSPEND: 30.0
  };

  // Time windows for analysis
  private static readonly TIME_WINDOWS = {
    IMMEDIATE: 5 * 60 * 1000, // 5 minutes
    SHORT_TERM: 60 * 60 * 1000, // 1 hour
    MEDIUM_TERM: 24 * 60 * 60 * 1000, // 24 hours
    LONG_TERM: 7 * 24 * 60 * 60 * 1000 // 7 days
  };

  /**
   * Monitor a user action and check for suspicious behavior
   */
  static async monitorUserAction(
    userId: string,
    userName: string,
    action: string,
    resource: string,
    permitted: boolean,
    context: Record<string, any> = {}
  ): Promise<void> {
    // Log the access attempt
    this.logAccessAttempt({
      userId,
      userName,
      action,
      resource,
      permitted,
      timestamp: new Date().toISOString(),
      context
    });

    // If access was denied, check for suspicious patterns
    if (!permitted) {
      await this.analyzeFailedAccess(userId, userName, action, resource, context);
    }

    // Update naughty list if needed
    await this.updateNaughtyListEntry(userId, userName, permitted, action);

    // Check for unusual behavior patterns
    await this.checkForUnusualBehavior(userId, userName);
  }

  /**
   * Analyze failed access attempts for suspicious patterns
   */
  private static async analyzeFailedAccess(
    userId: string,
    userName: string,
    action: string,
    resource: string,
    context: Record<string, any>
  ): Promise<void> {
    const recentFailures = this.getRecentFailedAttempts(userId);
    const riskScore = this.calculateRiskScore(userId, action, recentFailures);

    // Create alert based on risk level
    if (riskScore >= 15.0) {
      await this.createSecurityAlert({
        userId,
        userName,
        type: 'repeated_failures',
        severity: 'high',
        title: 'Multiple Unauthorized Access Attempts',
        description: `User ${userName} has made ${recentFailures} failed access attempts in the last hour`,
        details: {
          action,
          resource,
          recentFailures,
          riskScore,
          context
        }
      });
    } else if (riskScore >= 10.0) {
      await this.createSecurityAlert({
        userId,
        userName,
        type: 'unauthorized_access',
        severity: 'medium',
        title: 'Unauthorized Access Attempt',
        description: `User ${userName} attempted to access ${resource} without permission`,
        details: {
          action,
          resource,
          riskScore,
          context
        }
      });
    }

    // Check for privilege escalation attempts
    if (this.isPrivilegeEscalation(action, context)) {
      await this.createSecurityAlert({
        userId,
        userName,
        type: 'privilege_escalation',
        severity: 'critical',
        title: 'Privilege Escalation Attempt',
        description: `User ${userName} attempted to escalate privileges`,
        details: {
          action,
          resource,
          userRole: context.userRole,
          targetRole: context.targetRole,
          context
        }
      });
    }
  }

  /**
   * Check for unusual user behavior patterns
   */
  private static async checkForUnusualBehavior(
    userId: string,
    userName: string
  ): Promise<void> {
    const accessLogs = this.getAccessLogsForUser(userId);
    const recentLogs = accessLogs.filter(log =>
      new Date(log.timestamp).getTime() > Date.now() - this.TIME_WINDOWS.MEDIUM_TERM
    );

    // Check for unusual access patterns
    const unusualPatterns = this.detectUnusualPatterns(recentLogs);

    if (unusualPatterns.length > 0) {
      await this.createSecurityAlert({
        userId,
        userName,
        type: 'unusual_behavior',
        severity: 'medium',
        title: 'Unusual User Activity Detected',
        description: `Detected unusual access patterns for user ${userName}`,
        details: {
          patterns: unusualPatterns,
          totalActions: recentLogs.length,
          timeWindow: '24 hours'
        }
      });
    }
  }

  /**
   * Update or create naughty list entry for a user
   */
  private static async updateNaughtyListEntry(
    userId: string,
    userName: string,
    permitted: boolean,
    action: string
  ): Promise<void> {
    if (permitted) return; // Only track failed attempts

    const naughtyList = this.getNaughtyList();
    let entry = naughtyList.find(e => e.userId === userId);

    if (!entry) {
      // Create new entry
      entry = {
        userId,
        userName,
        email: '', // This would be fetched from user profile in production
        riskScore: 1.0,
        totalViolations: 1,
        recentViolations: 1,
        lastViolation: new Date().toISOString(),
        violationTypes: ['unauthorized_access'],
        status: 'watching',
        notes: [`First violation: attempted ${action}`],
        addedAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };
      naughtyList.push(entry);
    } else {
      // Update existing entry
      entry.totalViolations++;
      entry.recentViolations = this.getRecentFailedAttempts(userId);
      entry.lastViolation = new Date().toISOString();
      entry.riskScore = this.calculateUserRiskScore(userId);
      entry.updatedAt = new Date().toISOString();
      entry.notes.push(`${new Date().toLocaleString()}: attempted ${action}`);

      // Keep only last 10 notes
      if (entry.notes.length > 10) {
        entry.notes = entry.notes.slice(-10);
      }

      // Update status based on risk score
      if (entry.riskScore >= this.RISK_THRESHOLDS.SUSPEND) {
        entry.status = 'suspended';
      } else if (entry.riskScore >= this.RISK_THRESHOLDS.RESTRICT) {
        entry.status = 'restricted';
      } else if (entry.riskScore >= this.RISK_THRESHOLDS.WARNING) {
        entry.status = 'warning';
      } else {
        entry.status = 'watching';
      }
    }

    this.saveNaughtyList(naughtyList);
  }

  /**
   * Create a new security alert
   */
  private static async createSecurityAlert(alertData: {
    userId: string;
    userName: string;
    type: SecurityAlertType;
    severity: 'low' | 'medium' | 'high' | 'critical';
    title: string;
    description: string;
    details: Record<string, any>;
  }): Promise<SecurityAlert> {
    const alert: SecurityAlert = {
      id: `alert_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      ...alertData,
      timestamp: new Date().toISOString(),
      acknowledged: false,
      actions: this.generateSecurityActions(alertData.type, alertData.severity)
    };

    const alerts = this.getSecurityAlerts();
    alerts.push(alert);

    // Keep only last 500 alerts to manage storage
    if (alerts.length > 500) {
      alerts.splice(0, alerts.length - 500);
    }

    this.saveSecurityAlerts(alerts);

    // Log to console for immediate visibility
    console.warn(`🚨 SECURITY ALERT [${alert.severity.toUpperCase()}]: ${alert.title}`, alert);

    return alert;
  }

  /**
   * Generate appropriate security actions for an alert
   */
  private static generateSecurityActions(
    type: SecurityAlertType,
    severity: 'low' | 'medium' | 'high' | 'critical'
  ): SecurityAction[] {
    const actions: SecurityAction[] = [];

    // Basic warning action for all alerts
    actions.push({
      id: 'warn',
      label: 'Send Warning',
      type: 'warning',
      requiresConfirmation: false
    });

    if (severity === 'high' || severity === 'critical') {
      actions.push({
        id: 'investigate',
        label: 'Start Investigation',
        type: 'investigation',
        requiresConfirmation: true
      });

      if (type === 'privilege_escalation' || type === 'potential_breach') {
        actions.push({
          id: 'suspend',
          label: 'Suspend User',
          type: 'suspension',
          requiresConfirmation: true
        });
      }
    }

    if (type === 'repeated_failures') {
      actions.push({
        id: 'reset_password',
        label: 'Force Password Reset',
        type: 'password_reset',
        requiresConfirmation: true
      });
    }

    return actions;
  }

  /**
   * Get all security alerts
   */
  static getSecurityAlerts(): SecurityAlert[] {
    try {
      return JSON.parse(localStorage.getItem(this.ALERTS_STORAGE_KEY) || '[]');
    } catch (error) {
      console.error('Failed to load security alerts:', error);
      return [];
    }
  }

  /**
   * Get naughty list (users with security violations)
   */
  static getNaughtyList(): NaughtyListEntry[] {
    try {
      return JSON.parse(localStorage.getItem(this.NAUGHTY_LIST_STORAGE_KEY) || '[]');
    } catch (error) {
      console.error('Failed to load naughty list:', error);
      return [];
    }
  }

  /**
   * Get security metrics for dashboard
   */
  static getSecurityMetrics(): SecurityMetrics {
    const alerts = this.getSecurityAlerts();
    const now = Date.now();

    const alertsByType: Record<SecurityAlertType, number> = {
      unauthorized_access: 0,
      repeated_failures: 0,
      suspicious_activity: 0,
      privilege_escalation: 0,
      data_access_violation: 0,
      unusual_behavior: 0,
      potential_breach: 0
    };

    let last24Hours = 0;
    let last7Days = 0;
    let last30Days = 0;

    alerts.forEach(alert => {
      alertsByType[alert.type]++;

      const alertTime = new Date(alert.timestamp).getTime();
      const ageInMs = now - alertTime;

      if (ageInMs <= 24 * 60 * 60 * 1000) last24Hours++;
      if (ageInMs <= 7 * 24 * 60 * 60 * 1000) last7Days++;
      if (ageInMs <= 30 * 24 * 60 * 60 * 1000) last30Days++;
    });

    return {
      totalAlerts: alerts.length,
      activeAlerts: alerts.filter(a => !a.acknowledged).length,
      acknowledgedAlerts: alerts.filter(a => a.acknowledged).length,
      highSeverityAlerts: alerts.filter(a => a.severity === 'high' || a.severity === 'critical').length,
      usersOnNaughtyList: this.getNaughtyList().length,
      alertsByType,
      alertTrends: {
        last24Hours,
        last7Days,
        last30Days
      }
    };
  }

  /**
   * Acknowledge a security alert
   */
  static acknowledgeAlert(alertId: string, acknowledgedBy: string): void {
    const alerts = this.getSecurityAlerts();
    const alert = alerts.find(a => a.id === alertId);

    if (alert) {
      alert.acknowledged = true;
      alert.acknowledgedBy = acknowledgedBy;
      alert.acknowledgedAt = new Date().toISOString();
      this.saveSecurityAlerts(alerts);
    }
  }

  /**
   * Remove user from naughty list
   */
  static removeFromNaughtyList(userId: string): void {
    const naughtyList = this.getNaughtyList();
    const filtered = naughtyList.filter(entry => entry.userId !== userId);
    this.saveNaughtyList(filtered);
  }

  // Private helper methods

  private static logAccessAttempt(attempt: {
    userId: string;
    userName: string;
    action: string;
    resource: string;
    permitted: boolean;
    timestamp: string;
    context: Record<string, any>;
  }): void {
    try {
      const logs = JSON.parse(localStorage.getItem(this.ACCESS_LOGS_STORAGE_KEY) || '[]');
      logs.push(attempt);

      // Keep only last 1000 entries
      if (logs.length > 1000) {
        logs.splice(0, logs.length - 1000);
      }

      localStorage.setItem(this.ACCESS_LOGS_STORAGE_KEY, JSON.stringify(logs));
    } catch (error) {
      console.error('Failed to log access attempt:', error);
    }
  }

  private static getAccessLogsForUser(userId: string): any[] {
    try {
      const logs = JSON.parse(localStorage.getItem(this.ACCESS_LOGS_STORAGE_KEY) || '[]');
      return logs.filter((log: any) => log.userId === userId);
    } catch (error) {
      console.error('Failed to get access logs:', error);
      return [];
    }
  }

  private static getRecentFailedAttempts(userId: string): number {
    const logs = this.getAccessLogsForUser(userId);
    const cutoff = Date.now() - this.TIME_WINDOWS.SHORT_TERM;

    return logs.filter(log =>
      !log.permitted &&
      new Date(log.timestamp).getTime() > cutoff
    ).length;
  }

  private static calculateRiskScore(
    userId: string,
    action: string,
    recentFailures: number
  ): number {
    let score = recentFailures * 2.0; // Base score from recent failures

    // Higher risk for sensitive actions
    const sensitiveActions = [
      'canViewGLAccounts',
      'canEditGLAccounts',
      'canViewFinancialReports',
      'canConfigureIngridAI',
      'canViewSecurityLogs'
    ];

    if (sensitiveActions.includes(action)) {
      score += 5.0;
    }

    // Consider historical violations
    const naughtyEntry = this.getNaughtyList().find(e => e.userId === userId);
    if (naughtyEntry) {
      score += naughtyEntry.totalViolations * 0.5;
    }

    return Math.min(score, 50.0); // Cap at 50
  }

  private static calculateUserRiskScore(userId: string): number {
    const recentFailures = this.getRecentFailedAttempts(userId);
    const totalLogs = this.getAccessLogsForUser(userId);
    const failureRate = totalLogs.length > 0 ?
      totalLogs.filter(log => !log.permitted).length / totalLogs.length : 0;

    return recentFailures * 3.0 + failureRate * 10.0;
  }

  private static isPrivilegeEscalation(action: string, context: Record<string, any>): boolean {
    // Check if user is trying to access admin functions
    const adminActions = [
      'canChangeUserRoles',
      'canConfigureIngridAI',
      'canViewSecurityLogs',
      'canDeleteUsers'
    ];

    return adminActions.includes(action) && context.userRole === 'user';
  }

  private static detectUnusualPatterns(logs: any[]): string[] {
    const patterns: string[] = [];

    // Check for unusual access times (outside business hours)
    const businessHourViolations = logs.filter(log => {
      const hour = new Date(log.timestamp).getHours();
      return hour < 6 || hour > 22; // Outside 6 AM - 10 PM
    });

    if (businessHourViolations.length > logs.length * 0.5) {
      patterns.push('Frequent after-hours access');
    }

    // Check for rapid-fire requests
    const rapidRequests = logs.filter((log, index) => {
      if (index === 0) return false;
      const timeDiff = new Date(log.timestamp).getTime() - new Date(logs[index - 1].timestamp).getTime();
      return timeDiff < 1000; // Less than 1 second between requests
    });

    if (rapidRequests.length > 5) {
      patterns.push('Rapid-fire access attempts');
    }

    // Check for accessing many different resources quickly
    const uniqueResources = new Set(logs.map(log => log.resource));
    if (uniqueResources.size > 10 && logs.length > 20) {
      patterns.push('Wide-ranging resource access');
    }

    return patterns;
  }

  private static saveSecurityAlerts(alerts: SecurityAlert[]): void {
    try {
      localStorage.setItem(this.ALERTS_STORAGE_KEY, JSON.stringify(alerts));
    } catch (error) {
      console.error('Failed to save security alerts:', error);
    }
  }

  private static saveNaughtyList(naughtyList: NaughtyListEntry[]): void {
    try {
      localStorage.setItem(this.NAUGHTY_LIST_STORAGE_KEY, JSON.stringify(naughtyList));
    } catch (error) {
      console.error('Failed to save naughty list:', error);
    }
  }
}