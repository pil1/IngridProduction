/**
 * Field Modification Tracker Component
 *
 * Tracks and displays field modifications with timestamps, sources,
 * and change history for audit trail purposes.
 */

import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import {
  Timeline,
  History,
  User,
  Brain,
  Edit,
  Clock,
  ChevronDown,
  ChevronRight,
  Eye,
  EyeOff,
  AlertCircle,
  CheckCircle
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Expense, FieldSource } from '@/types/expenses';
import { FieldSourceIcon } from '../indicators/FieldSourceIcon';
import { format } from 'date-fns';

export interface FieldModification {
  id: string;
  field_name: string;
  old_value: string | number | null;
  new_value: string | number | null;
  source: FieldSource;
  modified_by: string;
  modified_by_name?: string;
  modified_at: string;
  confidence_score?: number;
  change_reason?: string;
  validation_status?: 'pending' | 'approved' | 'rejected';
}

export interface FieldModificationTrackerProps {
  expense: Expense;
  modifications: FieldModification[];
  showAllFields?: boolean;
  compact?: boolean;
  onViewModification?: (modification: FieldModification) => void;
}

// Group modifications by field
const groupModificationsByField = (modifications: FieldModification[]) => {
  return modifications.reduce((groups, mod) => {
    if (!groups[mod.field_name]) {
      groups[mod.field_name] = [];
    }
    groups[mod.field_name].push(mod);
    return groups;
  }, {} as Record<string, FieldModification[]>);
};

// Get field display name
const getFieldDisplayName = (fieldName: string) => {
  const fieldNames: Record<string, string> = {
    amount: 'Amount',
    description: 'Description',
    vendor_name: 'Vendor',
    expense_date: 'Date',
    category_id: 'Category',
    receipt_url: 'Receipt',
    notes: 'Notes',
    gl_account_id: 'GL Account',
    project_code: 'Project Code',
    location_id: 'Location',
    custom_field_1: 'Custom Field 1',
    custom_field_2: 'Custom Field 2',
    tax_amount: 'Tax Amount',
    currency: 'Currency'
  };
  return fieldNames[fieldName] || fieldName.charAt(0).toUpperCase() + fieldName.slice(1);
};

// Format field value for display
const formatFieldValue = (value: string | number | null, fieldName: string) => {
  if (value === null || value === undefined) return 'N/A';

  if (fieldName === 'amount' || fieldName === 'tax_amount') {
    return `$${Number(value).toFixed(2)}`;
  }

  if (fieldName === 'expense_date') {
    return format(new Date(value), 'MMM dd, yyyy');
  }

  return String(value);
};

// Get change severity
const getChangeSeverity = (oldValue: any, newValue: any, fieldName: string) => {
  if (fieldName === 'amount' || fieldName === 'tax_amount') {
    const oldNum = Number(oldValue) || 0;
    const newNum = Number(newValue) || 0;
    const diff = Math.abs(newNum - oldNum);
    const percentChange = oldNum > 0 ? (diff / oldNum) * 100 : 100;

    if (percentChange > 50) return 'high';
    if (percentChange > 20) return 'medium';
    return 'low';
  }

  // For other fields, consider any change as medium severity
  return oldValue !== newValue ? 'medium' : 'low';
};

export const FieldModificationTracker: React.FC<FieldModificationTrackerProps> = ({
  expense,
  modifications,
  showAllFields = false,
  compact = false,
  onViewModification
}) => {
  const [isExpanded, setIsExpanded] = useState(!compact);
  const [showOnlyModified, setShowOnlyModified] = useState(true);

  const groupedModifications = groupModificationsByField(modifications);
  const modifiedFields = Object.keys(groupedModifications);

  if (modifications.length === 0 && !showAllFields) {
    return (
      <Card className="border-gray-200">
        <CardContent className="p-4">
          <div className="flex items-center gap-2 text-sm text-gray-500">
            <History className="h-4 w-4" />
            <span>No field modifications recorded</span>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (compact) {
    return (
      <Card className="border-blue-200">
        <CardContent className="p-4">
          <Collapsible open={isExpanded} onOpenChange={setIsExpanded}>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Timeline className="h-4 w-4 text-blue-500" />
                <span className="font-medium text-sm">Modification History</span>
                <Badge variant="secondary" className="text-xs">
                  {modifications.length} changes
                </Badge>
              </div>
              <CollapsibleTrigger asChild>
                <Button variant="ghost" size="sm">
                  {isExpanded ? (
                    <ChevronDown className="h-4 w-4" />
                  ) : (
                    <ChevronRight className="h-4 w-4" />
                  )}
                </Button>
              </CollapsibleTrigger>
            </div>

            <CollapsibleContent className="mt-3">
              <div className="space-y-2">
                {modifications.slice(0, 3).map((mod, index) => (
                  <div key={mod.id} className="flex items-center gap-2 text-sm p-2 bg-gray-50 rounded">
                    <FieldSourceIcon source={mod.source} size="xs" showTooltip={false} />
                    <span className="flex-1 truncate">
                      {getFieldDisplayName(mod.field_name)}
                    </span>
                    <span className="text-xs text-gray-500">
                      {format(new Date(mod.modified_at), 'MMM dd')}
                    </span>
                  </div>
                ))}
                {modifications.length > 3 && (
                  <div className="text-xs text-gray-500 text-center py-1">
                    +{modifications.length - 3} more changes
                  </div>
                )}
              </div>
            </CollapsibleContent>
          </Collapsible>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="border-blue-200">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm flex items-center gap-2">
            <Timeline className="h-4 w-4 text-blue-500" />
            Field Modification History
          </CardTitle>
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setShowOnlyModified(!showOnlyModified)}
              className="text-xs"
            >
              {showOnlyModified ? (
                <>
                  <Eye className="h-3 w-3 mr-1" />
                  Show All
                </>
              ) : (
                <>
                  <EyeOff className="h-3 w-3 mr-1" />
                  Modified Only
                </>
              )}
            </Button>
            <Badge variant="secondary" className="text-xs">
              {modifications.length} changes
            </Badge>
          </div>
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        {Object.entries(groupedModifications).map(([fieldName, fieldMods]) => {
          const latestMod = fieldMods[0]; // Assuming sorted by date desc
          const severity = getChangeSeverity(latestMod.old_value, latestMod.new_value, fieldName);

          return (
            <div key={fieldName} className="space-y-3">
              <div className="flex items-center gap-2">
                <h4 className="font-medium text-sm">{getFieldDisplayName(fieldName)}</h4>
                <Badge
                  variant={severity === 'high' ? 'destructive' : severity === 'medium' ? 'default' : 'secondary'}
                  className="text-xs"
                >
                  {fieldMods.length} change{fieldMods.length > 1 ? 's' : ''}
                </Badge>
              </div>

              <div className="space-y-2 pl-4 border-l-2 border-gray-200">
                {fieldMods.map((mod, index) => (
                  <div key={mod.id} className="space-y-2">
                    <div className="flex items-start gap-3 p-3 bg-gray-50 rounded-lg">
                      <div className="flex items-center gap-2 min-w-0 flex-1">
                        <FieldSourceIcon source={mod.source} size="sm" />

                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2 mb-1">
                            <span className="text-xs font-medium text-gray-600">
                              {mod.modified_by_name || 'Unknown User'}
                            </span>
                            <span className="text-xs text-gray-500">
                              {format(new Date(mod.modified_at), 'MMM dd, yyyy HH:mm')}
                            </span>
                          </div>

                          <div className="text-sm">
                            <span className="text-gray-600">From:</span>
                            <span className="ml-1 font-mono text-red-600">
                              {formatFieldValue(mod.old_value, fieldName)}
                            </span>
                            <span className="mx-2 text-gray-400">→</span>
                            <span className="text-gray-600">To:</span>
                            <span className="ml-1 font-mono text-green-600">
                              {formatFieldValue(mod.new_value, fieldName)}
                            </span>
                          </div>

                          {mod.confidence_score && (
                            <div className="flex items-center gap-1 mt-1">
                              <span className="text-xs text-gray-500">Confidence:</span>
                              <Badge
                                variant={mod.confidence_score >= 0.9 ? 'default' :
                                        mod.confidence_score >= 0.7 ? 'secondary' : 'destructive'}
                                className="text-xs"
                              >
                                {Math.round(mod.confidence_score * 100)}%
                              </Badge>
                            </div>
                          )}

                          {mod.change_reason && (
                            <div className="text-xs text-gray-600 mt-1">
                              <span className="font-medium">Reason:</span> {mod.change_reason}
                            </div>
                          )}
                        </div>
                      </div>

                      <div className="flex items-center gap-1">
                        {mod.validation_status && (
                          <div className="flex items-center gap-1">
                            {mod.validation_status === 'approved' && (
                              <CheckCircle className="h-3 w-3 text-green-500" />
                            )}
                            {mod.validation_status === 'rejected' && (
                              <AlertCircle className="h-3 w-3 text-red-500" />
                            )}
                            {mod.validation_status === 'pending' && (
                              <Clock className="h-3 w-3 text-amber-500" />
                            )}
                          </div>
                        )}

                        {onViewModification && (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => onViewModification(mod)}
                            className="h-6 w-6 p-0"
                          >
                            <Eye className="h-3 w-3" />
                          </Button>
                        )}
                      </div>
                    </div>

                    {index < fieldMods.length - 1 && (
                      <div className="flex items-center gap-2 pl-2">
                        <div className="w-2 h-2 rounded-full bg-gray-300" />
                        <div className="text-xs text-gray-400">Earlier changes</div>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          );
        })}

        {modifications.length === 0 && (
          <div className="text-center py-8 text-gray-500">
            <History className="h-8 w-8 mx-auto mb-2 opacity-50" />
            <p className="text-sm">No modifications recorded for this expense</p>
            <p className="text-xs mt-1">Changes will appear here when fields are updated</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
};