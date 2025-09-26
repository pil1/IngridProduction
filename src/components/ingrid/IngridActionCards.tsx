/**
 * Ingrid Action Cards Panel
 *
 * Displays AI-generated action cards based on Ingrid's suggestions.
 * Users can review, edit, and approve/reject these suggestions.
 */

import React, { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Receipt,
  Building,
  Users,
  Tag,
  Check,
  X,
  Edit3,
  Star,
  Clock,
  DollarSign,
  Calendar,
  MapPin,
  Phone,
  Mail,
  Globe,
  CheckCircle2,
  XCircle,
  AlertTriangle
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { format } from 'date-fns';

interface ActionCard {
  id: string;
  type: 'expense' | 'vendor' | 'customer' | 'category';
  title: string;
  description: string;
  data: any;
  confidence?: number;
  status: 'suggested' | 'approved' | 'rejected';
  createdAt: Date;
}

interface IngridActionCardsProps {
  actionCards: ActionCard[];
  onApprove: (cardId: string, editedData?: any) => void;
  onReject: (cardId: string, reason?: string) => void;
  onEdit: (cardId: string, newData: any) => void;
  className?: string;
}

export function IngridActionCards({
  actionCards,
  onApprove,
  onReject,
  onEdit,
  className
}: IngridActionCardsProps) {
  const [selectedCard, setSelectedCard] = useState<ActionCard | null>(null);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [editedData, setEditedData] = useState<any>({});

  const getCardIcon = (type: string) => {
    switch (type) {
      case 'expense':
        return <Receipt className="h-5 w-5" />;
      case 'vendor':
        return <Building className="h-5 w-5" />;
      case 'customer':
        return <Users className="h-5 w-5" />;
      case 'category':
        return <Tag className="h-5 w-5" />;
      default:
        return <Receipt className="h-5 w-5" />;
    }
  };

  const getConfidenceBadge = (confidence?: number) => {
    if (!confidence) return null;

    let variant: 'default' | 'secondary' | 'destructive' | 'outline' = 'secondary';
    let label = 'Low Confidence';

    if (confidence >= 90) {
      variant = 'default';
      label = 'High Confidence';
    } else if (confidence >= 70) {
      variant = 'outline';
      label = 'Medium Confidence';
    }

    return (
      <Badge variant={variant} className="text-xs">
        <Star className="h-3 w-3 mr-1" />
        {confidence}% {label}
      </Badge>
    );
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'approved':
        return <CheckCircle2 className="h-4 w-4 text-green-500" />;
      case 'rejected':
        return <XCircle className="h-4 w-4 text-red-500" />;
      case 'suggested':
        return <Clock className="h-4 w-4 text-blue-500" />;
      default:
        return <AlertTriangle className="h-4 w-4 text-yellow-500" />;
    }
  };

  const handleEdit = (card: ActionCard) => {
    setSelectedCard(card);
    setEditedData(card.data);
    setIsEditDialogOpen(true);
  };

  const handleSaveEdit = () => {
    if (!selectedCard) return;

    onEdit(selectedCard.id, editedData);
    setIsEditDialogOpen(false);
    setSelectedCard(null);
    setEditedData({});
  };

  const renderExpenseFields = () => (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-4">
        <div>
          <Label>Amount</Label>
          <Input
            type="number"
            value={editedData.amount || ''}
            onChange={(e) => setEditedData({ ...editedData, amount: parseFloat(e.target.value) })}
            placeholder="0.00"
          />
        </div>
        <div>
          <Label>Date</Label>
          <Input
            type="date"
            value={editedData.date ? format(new Date(editedData.date), 'yyyy-MM-dd') : ''}
            onChange={(e) => setEditedData({ ...editedData, date: new Date(e.target.value) })}
          />
        </div>
      </div>

      <div>
        <Label>Vendor</Label>
        <Input
          value={editedData.vendor || ''}
          onChange={(e) => setEditedData({ ...editedData, vendor: e.target.value })}
          placeholder="Vendor name"
        />
      </div>

      <div>
        <Label>Category</Label>
        <Select value={editedData.category || ''} onValueChange={(value) => setEditedData({ ...editedData, category: value })}>
          <SelectTrigger>
            <SelectValue placeholder="Select category" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="meals">Meals & Entertainment</SelectItem>
            <SelectItem value="office">Office Supplies</SelectItem>
            <SelectItem value="travel">Travel</SelectItem>
            <SelectItem value="utilities">Utilities</SelectItem>
            <SelectItem value="other">Other</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div>
        <Label>Description</Label>
        <Textarea
          value={editedData.description || ''}
          onChange={(e) => setEditedData({ ...editedData, description: e.target.value })}
          placeholder="Expense description"
        />
      </div>
    </div>
  );

  const renderVendorFields = () => (
    <div className="space-y-4">
      <div>
        <Label>Company Name</Label>
        <Input
          value={editedData.companyName || editedData.extractedVendor || ''}
          onChange={(e) => setEditedData({ ...editedData, companyName: e.target.value })}
          placeholder="Company name"
        />
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <Label>Contact Person</Label>
          <Input
            value={editedData.contactPerson || ''}
            onChange={(e) => setEditedData({ ...editedData, contactPerson: e.target.value })}
            placeholder="Contact name"
          />
        </div>
        <div>
          <Label>Email</Label>
          <Input
            type="email"
            value={editedData.email || ''}
            onChange={(e) => setEditedData({ ...editedData, email: e.target.value })}
            placeholder="email@company.com"
          />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <Label>Phone</Label>
          <Input
            value={editedData.phone || ''}
            onChange={(e) => setEditedData({ ...editedData, phone: e.target.value })}
            placeholder="Phone number"
          />
        </div>
        <div>
          <Label>Website</Label>
          <Input
            value={editedData.website || ''}
            onChange={(e) => setEditedData({ ...editedData, website: e.target.value })}
            placeholder="https://company.com"
          />
        </div>
      </div>

      <div>
        <Label>Address</Label>
        <Textarea
          value={editedData.address || ''}
          onChange={(e) => setEditedData({ ...editedData, address: e.target.value })}
          placeholder="Business address"
        />
      </div>
    </div>
  );

  const renderCardDetails = (card: ActionCard) => {
    const { data } = card;

    switch (card.type) {
      case 'expense':
        return (
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-4">
              <div className="flex items-center gap-2">
                <DollarSign className="h-4 w-4 text-muted-foreground" />
                <div>
                  <p className="text-sm font-medium">Amount</p>
                  <p className="text-sm text-muted-foreground">
                    ${data.amount || data.extractedAmount || 'N/A'}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Calendar className="h-4 w-4 text-muted-foreground" />
                <div>
                  <p className="text-sm font-medium">Date</p>
                  <p className="text-sm text-muted-foreground">
                    {data.date || data.extractedDate ? format(new Date(data.date || data.extractedDate), 'MMM dd, yyyy') : 'Today'}
                  </p>
                </div>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <Building className="h-4 w-4 text-muted-foreground" />
              <div>
                <p className="text-sm font-medium">Vendor</p>
                <p className="text-sm text-muted-foreground">
                  {data.vendor || data.extractedVendor || 'Unknown vendor'}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <Tag className="h-4 w-4 text-muted-foreground" />
              <div>
                <p className="text-sm font-medium">Category</p>
                <p className="text-sm text-muted-foreground">
                  {data.category || 'Office Expenses'}
                </p>
              </div>
            </div>
          </div>
        );

      case 'vendor':
        return (
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <Building className="h-4 w-4 text-muted-foreground" />
              <div>
                <p className="text-sm font-medium">Company</p>
                <p className="text-sm text-muted-foreground">
                  {data.companyName || data.extractedVendor || 'Unknown company'}
                </p>
              </div>
            </div>

            {data.email && (
              <div className="flex items-center gap-2">
                <Mail className="h-4 w-4 text-muted-foreground" />
                <div>
                  <p className="text-sm font-medium">Email</p>
                  <p className="text-sm text-muted-foreground">{data.email}</p>
                </div>
              </div>
            )}

            {data.phone && (
              <div className="flex items-center gap-2">
                <Phone className="h-4 w-4 text-muted-foreground" />
                <div>
                  <p className="text-sm font-medium">Phone</p>
                  <p className="text-sm text-muted-foreground">{data.phone}</p>
                </div>
              </div>
            )}

            {data.website && (
              <div className="flex items-center gap-2">
                <Globe className="h-4 w-4 text-muted-foreground" />
                <div>
                  <p className="text-sm font-medium">Website</p>
                  <p className="text-sm text-muted-foreground">{data.website}</p>
                </div>
              </div>
            )}
          </div>
        );

      default:
        return (
          <div className="text-sm text-muted-foreground">
            {JSON.stringify(data, null, 2)}
          </div>
        );
    }
  };

  const pendingCards = actionCards.filter(card => card.status === 'suggested');
  const processedCards = actionCards.filter(card => card.status !== 'suggested');

  return (
    <div className={cn("flex flex-col h-full", className)}>
      <div className="flex-shrink-0 p-4 border-b">
        <div className="flex items-center justify-between">
          <h3 className="font-semibold">Action Cards</h3>
          {pendingCards.length > 0 && (
            <Badge variant="secondary" className="text-xs">
              {pendingCards.length} pending
            </Badge>
          )}
        </div>
      </div>

      <ScrollArea className="flex-1">
        <div className="p-4 space-y-4">
          {/* Pending Cards */}
          {pendingCards.length > 0 && (
            <div className="space-y-4">
              <div className="flex items-center gap-2">
                <Clock className="h-4 w-4" />
                <h3 className="font-medium">Pending Review</h3>
              </div>

              {pendingCards.map((card) => (
                <Card key={card.id} className="relative">
                  <CardHeader className="pb-3">
                    <div className="flex items-start justify-between">
                      <div className="flex items-center gap-3">
                        <div className="p-2 rounded-lg bg-primary/10">
                          {getCardIcon(card.type)}
                        </div>
                        <div>
                          <CardTitle className="text-base">{card.title}</CardTitle>
                          <CardDescription className="text-sm">
                            {card.description}
                          </CardDescription>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        {getConfidenceBadge(card.confidence)}
                        {getStatusIcon(card.status)}
                      </div>
                    </div>
                  </CardHeader>

                  <CardContent className="pt-0">
                    {renderCardDetails(card)}

                    <Separator className="my-4" />

                    <div className="flex items-center justify-between">
                      <p className="text-xs text-muted-foreground">
                        Created {format(card.createdAt, 'MMM dd, HH:mm')}
                      </p>

                      <div className="flex gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleEdit(card)}
                        >
                          <Edit3 className="h-3 w-3 mr-1" />
                          Edit
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => onReject(card.id, 'User rejected')}
                        >
                          <X className="h-3 w-3 mr-1" />
                          Reject
                        </Button>
                        <Button
                          size="sm"
                          onClick={() => onApprove(card.id)}
                        >
                          <Check className="h-3 w-3 mr-1" />
                          Approve
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}

          {/* Processed Cards */}
          {processedCards.length > 0 && (
            <div className="space-y-4">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4" />
                <h3 className="font-medium">Recent Activity</h3>
              </div>

              {processedCards.slice(0, 5).map((card) => (
                <Card key={card.id} className="opacity-60">
                  <CardHeader className="pb-2">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className="p-1 rounded bg-muted">
                          {getCardIcon(card.type)}
                        </div>
                        <div>
                          <CardTitle className="text-sm">{card.title}</CardTitle>
                          <CardDescription className="text-xs">
                            {card.status === 'approved' ? 'Approved' : 'Rejected'} • {format(card.createdAt, 'MMM dd, HH:mm')}
                          </CardDescription>
                        </div>
                      </div>
                      {getStatusIcon(card.status)}
                    </div>
                  </CardHeader>
                </Card>
              ))}
            </div>
          )}

          {/* Empty State */}
          {actionCards.length === 0 && (
            <div className="text-center py-12">
              <div className="p-4 rounded-full bg-muted inline-block mb-4">
                <Receipt className="h-8 w-8 text-muted-foreground" />
              </div>
              <h3 className="text-lg font-medium mb-2">No Action Cards Yet</h3>
              <p className="text-muted-foreground">
                Upload documents or chat with Ingrid to generate AI-powered suggestions
              </p>
            </div>
          )}
        </div>
      </ScrollArea>

      {/* Edit Dialog */}
      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
        <DialogContent className="max-w-md max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Edit {selectedCard?.type} Details</DialogTitle>
            <DialogDescription>
              Review and modify the AI-extracted information before approving.
            </DialogDescription>
          </DialogHeader>

          <div className="py-4">
            {selectedCard?.type === 'expense' && renderExpenseFields()}
            {selectedCard?.type === 'vendor' && renderVendorFields()}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setIsEditDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleSaveEdit}>
              Save Changes
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}