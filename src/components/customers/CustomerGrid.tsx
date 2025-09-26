/**
 * Customer Grid Component
 *
 * Reusable customer display component with card-based layout.
 * Supports loading states, error handling, and permission-based actions.
 */

import React from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Building2,
  Mail,
  Phone,
  MapPin,
  Globe,
  Edit,
  Eye,
  Trash2,
  Bot,
  Loader2,
  AlertCircle
} from 'lucide-react';

// Import customer type from the existing page
import { Customer } from '@/pages/CustomersPage';

interface CustomerGridProps {
  customers: Customer[];
  loading: boolean;
  onEdit?: (customer: Customer) => void;
  onView?: (customer: Customer) => void;
  onDelete?: (customer: Customer) => void;
  canEdit?: boolean;
  canDelete?: boolean;
  showAiBadges?: boolean;
  error?: string | null;
}

const CustomerGrid: React.FC<CustomerGridProps> = ({
  customers,
  loading,
  onEdit,
  onView,
  onDelete,
  canEdit = false,
  canDelete = false,
  showAiBadges = false,
  error
}) => {
  // Loading state
  if (loading) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {Array.from({ length: 6 }).map((_, index) => (
          <Card key={index} className="p-4">
            <CardContent className="space-y-3">
              <div className="flex items-center justify-between">
                <Skeleton className="h-5 w-32" />
                <Skeleton className="h-6 w-16" />
              </div>
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-4 w-3/4" />
              <div className="flex gap-2">
                <Skeleton className="h-8 w-16" />
                <Skeleton className="h-8 w-16" />
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-center">
        <AlertCircle className="h-12 w-12 text-destructive mb-4" />
        <h3 className="text-lg font-semibold mb-2">Error Loading Customers</h3>
        <p className="text-muted-foreground">{error}</p>
      </div>
    );
  }

  // Empty state
  if (!customers || customers.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-center">
        <Building2 className="h-12 w-12 text-muted-foreground mb-4" />
        <h3 className="text-lg font-semibold mb-2">No Customers Found</h3>
        <p className="text-muted-foreground">
          Start by adding your first customer to begin managing your customer relationships.
        </p>
      </div>
    );
  }

  // Customer card component
  const CustomerCard: React.FC<{ customer: Customer }> = ({ customer }) => {
    const hasContact = customer.email || customer.phone;
    const hasAddress = customer.address_line_1 || customer.city;

    return (
      <Card className="group hover:shadow-md transition-shadow duration-200">
        <CardContent className="p-6">
          {/* Header with name and status */}
          <div className="flex items-start justify-between mb-4">
            <div className="flex-1 min-w-0">
              <h3 className="font-semibold text-lg truncate flex items-center gap-2">
                <Building2 className="h-5 w-5 text-blue-600 flex-shrink-0" />
                {customer.name}
              </h3>
              {customer.contact_person && (
                <p className="text-sm text-muted-foreground mt-1">
                  Contact: {customer.contact_person}
                </p>
              )}
            </div>
            <div className="flex items-center gap-2 ml-2">
              {showAiBadges && (
                <Badge variant="secondary" className="text-xs">
                  <Bot className="h-3 w-3 mr-1" />
                  AI
                </Badge>
              )}
              <Badge variant={customer.is_active ? "default" : "secondary"}>
                {customer.is_active ? "Active" : "Inactive"}
              </Badge>
            </div>
          </div>

          {/* Contact Information */}
          {hasContact && (
            <div className="space-y-2 mb-4">
              {customer.email && (
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Mail className="h-4 w-4" />
                  <span className="truncate">{customer.email}</span>
                </div>
              )}
              {customer.phone && (
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Phone className="h-4 w-4" />
                  <span>{customer.phone}</span>
                </div>
              )}
              {customer.website && (
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Globe className="h-4 w-4" />
                  <span className="truncate">{customer.website}</span>
                </div>
              )}
            </div>
          )}

          {/* Address Information */}
          {hasAddress && (
            <div className="mb-4">
              <div className="flex items-start gap-2 text-sm text-muted-foreground">
                <MapPin className="h-4 w-4 mt-0.5 flex-shrink-0" />
                <div className="flex-1 min-w-0">
                  {customer.address_line_1 && (
                    <div className="truncate">{customer.address_line_1}</div>
                  )}
                  {(customer.city || customer.state_province || customer.postal_code) && (
                    <div className="truncate">
                      {[customer.city, customer.state_province, customer.postal_code]
                        .filter(Boolean)
                        .join(', ')}
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* Financial Information */}
          {(customer.credit_limit || customer.payment_terms) && (
            <div className="mb-4 p-3 bg-muted/50 rounded-md">
              <div className="text-xs font-medium text-muted-foreground mb-1">Financial Info</div>
              <div className="space-y-1">
                {customer.credit_limit && (
                  <div className="text-sm">
                    Credit Limit: ${customer.credit_limit.toLocaleString()}
                  </div>
                )}
                {customer.payment_terms && (
                  <div className="text-sm">Terms: {customer.payment_terms}</div>
                )}
              </div>
            </div>
          )}

          {/* Actions */}
          <div className="flex gap-2 pt-2 border-t">
            {/* View/Edit button */}
            {(onView || onEdit) && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  if (canEdit && onEdit) {
                    onEdit(customer);
                  } else if (onView) {
                    onView(customer);
                  }
                }}
                className="flex-1"
              >
                {canEdit ? (
                  <>
                    <Edit className="h-4 w-4 mr-2" />
                    Edit
                  </>
                ) : (
                  <>
                    <Eye className="h-4 w-4 mr-2" />
                    View
                  </>
                )}
              </Button>
            )}

            {/* Delete button */}
            {canDelete && onDelete && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => onDelete(customer)}
                className="text-destructive hover:text-destructive"
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            )}
          </div>

          {/* Additional badges */}
          <div className="flex gap-2 mt-3">
            {customer.tax_exempt && (
              <Badge variant="outline" className="text-xs">Tax Exempt</Badge>
            )}
            {customer.on_hold && (
              <Badge variant="destructive" className="text-xs">On Hold</Badge>
            )}
            {customer.spire_customer_id && (
              <Badge variant="outline" className="text-xs">Synced</Badge>
            )}
          </div>
        </CardContent>
      </Card>
    );
  };

  // Ensure customers is an array
  if (!Array.isArray(customers)) {
    console.log('Customers is not an array:', customers);
    return (
      <div className="flex flex-col items-center justify-center py-12 text-center">
        <AlertCircle className="h-12 w-12 text-muted-foreground mb-4" />
        <h3 className="text-lg font-semibold mb-2">Data Format Error</h3>
        <p className="text-muted-foreground">Invalid customer data format received.</p>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
      {customers.map((customer) => (
        <CustomerCard key={customer.id} customer={customer} />
      ))}
    </div>
  );
};

export default CustomerGrid;