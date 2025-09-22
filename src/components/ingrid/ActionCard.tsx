/**
 * Action Card Component
 *
 * Interactive approval cards that represent specific workflows
 * users can approve or modify. Core part of the Ingrid experience.
 */

import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import {
  CheckCircle2,
  XCircle,
  Clock,
  DollarSign,
  User,
  Building,
  FileText,
  Sparkles
} from 'lucide-react';
import { ActionCard as ActionCardType } from '@/types/ingrid';

interface ActionCardProps {
  action: ActionCardType;
  onApprove: () => void;
  onReject: () => void;
  className?: string;
}

export const ActionCard: React.FC<ActionCardProps> = ({
  action,
  onApprove,
  onReject,
  className
}) => {
  const getActionIcon = () => {
    switch (action.type) {
      case 'create_expense':
      case 'create_expense_with_spire':
        return <DollarSign className="h-4 w-4" />;
      case 'create_contact':
        return <User className="h-4 w-4" />;
      case 'create_vendor':
        return <Building className="h-4 w-4" />;
      default:
        return <FileText className="h-4 w-4" />;
    }
  };

  const getConfidenceColor = () => {
    if (action.confidence >= 90) return 'text-green-600';
    if (action.confidence >= 70) return 'text-yellow-600';
    return 'text-red-600';
  };

  const getStatusBadge = () => {
    switch (action.status) {
      case 'pending':
        return <Badge variant="secondary"><Clock className="h-3 w-3 mr-1" />Pending</Badge>;
      case 'approved':
        return <Badge variant="default" className="bg-green-600"><CheckCircle2 className="h-3 w-3 mr-1" />Approved</Badge>;
      case 'rejected':
        return <Badge variant="destructive"><XCircle className="h-3 w-3 mr-1" />Rejected</Badge>;
      case 'executed':
        return <Badge variant="default" className="bg-blue-600"><Sparkles className="h-3 w-3 mr-1" />Executed</Badge>;
      default:
        return <Badge variant="outline">{action.status}</Badge>;
    }
  };

  const renderActionData = () => {
    switch (action.type) {
      case 'create_expense':
      case 'create_expense_with_spire':
        return (
          <div className="space-y-2 text-sm">
            {action.data.vendor_name && (
              <div className="flex justify-between">
                <span className="text-muted-foreground">Vendor:</span>
                <span className="font-medium">{action.data.vendor_name}</span>
              </div>
            )}
            {action.data.amount && (
              <div className="flex justify-between">
                <span className="text-muted-foreground">Amount:</span>
                <span className="font-medium">${action.data.amount}</span>
              </div>
            )}
            {action.data.expense_date && (
              <div className="flex justify-between">
                <span className="text-muted-foreground">Date:</span>
                <span className="font-medium">{action.data.expense_date}</span>
              </div>
            )}
            {action.data.description && (
              <div className="flex justify-between">
                <span className="text-muted-foreground">Description:</span>
                <span className="font-medium truncate ml-2">{action.data.description}</span>
              </div>
            )}
            {action.type === 'create_expense_with_spire' && (
              <div className="flex justify-between">
                <span className="text-muted-foreground">GL Account:</span>
                <span className="font-medium">{action.data.suggested_gl_account || 'Auto-detect'}</span>
              </div>
            )}
          </div>
        );

      case 'create_contact':
        return (
          <div className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Name:</span>
              <span className="font-medium">{action.data.first_name} {action.data.last_name}</span>
            </div>
            {action.data.company && (
              <div className="flex justify-between">
                <span className="text-muted-foreground">Company:</span>
                <span className="font-medium">{action.data.company}</span>
              </div>
            )}
            {action.data.email && (
              <div className="flex justify-between">
                <span className="text-muted-foreground">Email:</span>
                <span className="font-medium">{action.data.email}</span>
              </div>
            )}
            {action.data.phone && (
              <div className="flex justify-between">
                <span className="text-muted-foreground">Phone:</span>
                <span className="font-medium">{action.data.phone}</span>
              </div>
            )}
          </div>
        );

      case 'create_vendor':
        return (
          <div className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Company:</span>
              <span className="font-medium">{action.data.name}</span>
            </div>
            {action.data.contact_person && (
              <div className="flex justify-between">
                <span className="text-muted-foreground">Contact:</span>
                <span className="font-medium">{action.data.contact_person}</span>
              </div>
            )}
            {action.data.industry && (
              <div className="flex justify-between">
                <span className="text-muted-foreground">Industry:</span>
                <span className="font-medium">{action.data.industry}</span>
              </div>
            )}
          </div>
        );

      default:
        return (
          <div className="text-sm text-muted-foreground">
            <p>Review the extracted data and approve to proceed.</p>
            {Object.keys(action.data).length > 0 && (
              <div className="mt-2 p-2 bg-muted/50 rounded text-xs">
                <pre className="whitespace-pre-wrap">{JSON.stringify(action.data, null, 2)}</pre>
              </div>
            )}
          </div>
        );
    }
  };

  const isInteractive = action.status === 'pending';

  return (
    <Card className={`border-l-4 border-l-blue-500 ${className}`}>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2 text-base">
            {getActionIcon()}
            {action.title}
          </CardTitle>
          <div className="flex items-center gap-2">
            <span className={`text-xs font-medium ${getConfidenceColor()}`}>
              {action.confidence}% confidence
            </span>
            {getStatusBadge()}
          </div>
        </div>
        <p className="text-sm text-muted-foreground">{action.description}</p>
      </CardHeader>

      <CardContent className="space-y-4">
        {renderActionData()}

        {action.approval_required && action.status === 'pending' && (
          <div className="p-2 bg-yellow-50 border border-yellow-200 rounded-md">
            <p className="text-xs text-yellow-800 flex items-center gap-1">
              <Clock className="h-3 w-3" />
              This action requires approval before execution
            </p>
          </div>
        )}

        {action.expiresAt && action.status === 'pending' && (
          <div className="text-xs text-muted-foreground">
            Expires: {new Date(action.expiresAt).toLocaleString()}
          </div>
        )}

        {isInteractive && (
          <>
            <Separator />
            <div className="flex gap-2 justify-end">
              <Button
                size="sm"
                variant="outline"
                onClick={onReject}
                className="text-red-600 hover:text-red-700"
              >
                <XCircle className="h-4 w-4 mr-1" />
                Decline
              </Button>
              <Button
                size="sm"
                onClick={onApprove}
                className="bg-green-600 hover:bg-green-700"
              >
                <CheckCircle2 className="h-4 w-4 mr-1" />
                {action.approval_required ? 'Approve' : 'Execute'}
              </Button>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
};