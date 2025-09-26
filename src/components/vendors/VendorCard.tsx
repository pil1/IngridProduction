/**
 * VendorCard Component
 *
 * Beautiful card-based display for vendor information with status indicators,
 * AI enrichment badges, and quick actions. Designed for the Ingrid-first approach.
 */

import React from 'react';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Building2,
  Mail,
  Phone,
  MapPin,
  Globe,
  MoreHorizontal,
  Edit,
  Trash2,
  Eye,
  Bot,
  CheckCircle,
  AlertCircle,
  RefreshCw,
  Star
} from 'lucide-react';
import { Vendor } from '@/pages/EnhancedVendorsPage';

interface VendorCardProps {
  vendor: Vendor;
  onEdit?: (vendor: Vendor) => void;
  onView?: (vendor: Vendor) => void;
  onDelete?: (vendor: Vendor) => void;
  onSync?: (vendor: Vendor) => void;
  canEdit?: boolean;
  canDelete?: boolean;
  canSync?: boolean;
  showAiBadges?: boolean;
}

export const VendorCard: React.FC<VendorCardProps> = ({
  vendor,
  onEdit,
  onView,
  onDelete,
  onSync,
  canEdit = false,
  canDelete = false,
  canSync = false,
  showAiBadges = false
}) => {
  const getVendorInitials = (name: string) => {
    return name
      .split(' ')
      .map(word => word.charAt(0))
      .join('')
      .substring(0, 2)
      .toUpperCase();
  };

  const getStatusColor = (isActive: boolean) => {
    return isActive ? 'bg-green-500' : 'bg-gray-400';
  };

  const hasContactInfo = vendor.email || vendor.phone;
  const hasAddress = vendor.address_line_1 || vendor.city;

  return (
    <Card className="group hover:shadow-lg transition-all duration-200 border-l-4 border-l-blue-500/20 hover:border-l-blue-500/60">
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between">
          <div className="flex items-center space-x-3">
            <div className="relative">
              <Avatar className="h-12 w-12 bg-gradient-to-br from-blue-500 to-purple-600">
                <AvatarFallback className="bg-transparent text-white font-semibold">
                  {getVendorInitials(vendor.name)}
                </AvatarFallback>
              </Avatar>
              {/* Status indicator */}
              <div className={`absolute -bottom-1 -right-1 w-4 h-4 ${getStatusColor(vendor.is_active)} rounded-full border-2 border-white`} />
            </div>

            <div className="flex-1 min-w-0">
              <h3 className="font-semibold text-lg text-gray-900 truncate">
                {vendor.name}
              </h3>
              {vendor.contact_person && (
                <p className="text-sm text-gray-600 truncate">
                  {vendor.contact_person}
                </p>
              )}
            </div>
          </div>

          <div className="flex items-center space-x-2">
            {/* AI Enhancement Badge */}
            {showAiBadges && (
              <Badge variant="secondary" className="bg-purple-100 text-purple-700 border-purple-200">
                <Bot className="w-3 h-3 mr-1" />
                AI Enhanced
              </Badge>
            )}

            {/* Spire Sync Status */}
            {vendor.spire_id && (
              <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200">
                <RefreshCw className="w-3 h-3 mr-1" />
                Synced
              </Badge>
            )}

            {/* Actions Menu */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="sm" className="opacity-0 group-hover:opacity-100 transition-opacity">
                  <MoreHorizontal className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-48">
                <DropdownMenuItem onClick={() => onView?.(vendor)}>
                  <Eye className="w-4 h-4 mr-2" />
                  View Details
                </DropdownMenuItem>
                {canEdit && (
                  <DropdownMenuItem onClick={() => onEdit?.(vendor)}>
                    <Edit className="w-4 h-4 mr-2" />
                    Edit Vendor
                  </DropdownMenuItem>
                )}
                {canSync && vendor.spire_id && (
                  <>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem onClick={() => onSync?.(vendor)}>
                      <RefreshCw className="w-4 h-4 mr-2" />
                      Sync with Spire
                    </DropdownMenuItem>
                  </>
                )}
                {canDelete && (
                  <>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem
                      onClick={() => onDelete?.(vendor)}
                      className="text-red-600 focus:text-red-600"
                    >
                      <Trash2 className="w-4 h-4 mr-2" />
                      Delete Vendor
                    </DropdownMenuItem>
                  </>
                )}
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      </CardHeader>

      <CardContent className="pt-0 space-y-4">
        {/* Contact Information */}
        {hasContactInfo && (
          <div className="space-y-2">
            {vendor.email && (
              <div className="flex items-center text-sm text-gray-600">
                <Mail className="w-4 h-4 mr-2 text-gray-400" />
                <span className="truncate">{vendor.email}</span>
              </div>
            )}
            {vendor.phone && (
              <div className="flex items-center text-sm text-gray-600">
                <Phone className="w-4 h-4 mr-2 text-gray-400" />
                <span>{vendor.phone}</span>
              </div>
            )}
            {vendor.website && (
              <div className="flex items-center text-sm text-gray-600">
                <Globe className="w-4 h-4 mr-2 text-gray-400" />
                <span className="truncate">{vendor.website}</span>
              </div>
            )}
          </div>
        )}

        {/* Address */}
        {hasAddress && (
          <div className="flex items-start text-sm text-gray-600">
            <MapPin className="w-4 h-4 mr-2 mt-0.5 text-gray-400 flex-shrink-0" />
            <div className="flex-1">
              {vendor.address_line_1 && (
                <div>{vendor.address_line_1}</div>
              )}
              {(vendor.city || vendor.state_province) && (
                <div>
                  {[vendor.city, vendor.state_province].filter(Boolean).join(', ')}
                  {vendor.postal_code && ` ${vendor.postal_code}`}
                </div>
              )}
              {vendor.country && vendor.country !== 'US' && (
                <div>{vendor.country}</div>
              )}
            </div>
          </div>
        )}

        {/* Payment Terms & Currency */}
        <div className="flex items-center justify-between pt-2 border-t border-gray-100">
          <div className="flex items-center space-x-4 text-xs text-gray-500">
            {vendor.payment_terms && (
              <span>Terms: {vendor.payment_terms}</span>
            )}
            {vendor.default_currency_code && (
              <Badge variant="outline" className="h-5 text-xs">
                {vendor.default_currency_code}
              </Badge>
            )}
          </div>

          {/* Status */}
          <div className="flex items-center space-x-1">
            {vendor.is_active ? (
              <CheckCircle className="w-4 h-4 text-green-500" />
            ) : (
              <AlertCircle className="w-4 h-4 text-gray-400" />
            )}
            <span className="text-xs text-gray-500">
              {vendor.is_active ? 'Active' : 'Inactive'}
            </span>
          </div>
        </div>

        {/* Quick Stats */}
        {vendor.tax_exempt && (
          <div className="flex justify-center pt-2">
            <Badge variant="secondary" className="bg-yellow-100 text-yellow-800 border-yellow-200">
              <Star className="w-3 h-3 mr-1" />
              Tax Exempt
            </Badge>
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default VendorCard;