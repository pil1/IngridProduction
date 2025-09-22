"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { useSession } from "@/components/SessionContextProvider";
import {
  Building2,
  CheckCircle,
  XCircle,
  Clock,
  TrendingUp,
  Users,
  Globe,
  Mail,
  Phone,
  MapPin,
  ExternalLink,
  Loader2,
  Search,
  Filter,
  MoreHorizontal,
  Eye,
  Merge,
  Star
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { SuggestedVendorService, type SuggestedVendor } from "@/services/ingrid/SuggestedVendorService";

interface VendorSuggestionStats {
  total: number;
  pending: number;
  approved: number;
  rejected: number;
  merged: number;
  avgConfidence: number;
  avgWebEnrichmentConfidence: number;
  topSuggestions: Array<{ name: string; count: number; confidence: number; hasWebData: boolean }>;
  webEnrichmentSuccess: number;
}

const SuggestedVendorsTab = () => {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const { profile } = useSession();

  const [searchTerm, setSearchTerm] = useState("");
  const [selectedSuggestions, setSelectedSuggestions] = useState<string[]>([]);
  const [isApprovalDialogOpen, setIsApprovalDialogOpen] = useState(false);
  const [isRejectDialogOpen, setIsRejectDialogOpen] = useState(false);
  const [isMergeDialogOpen, setIsMergeDialogOpen] = useState(false);
  const [currentSuggestion, setCurrentSuggestion] = useState<SuggestedVendor | null>(null);
  const [approvalData, setApprovalData] = useState({
    name: "",
    email: "",
    phone: "",
    website: "",
    addressLine1: "",
    addressLine2: "",
    city: "",
    state: "",
    country: "",
    postalCode: "",
    description: "",
    reviewNotes: ""
  });

  const companyId = profile?.company_id;

  // Fetch pending vendor suggestions
  const { data: suggestions, isLoading: isLoadingSuggestions, refetch: refetchSuggestions } = useQuery({
    queryKey: ["vendor_suggestions", companyId],
    queryFn: async () => {
      if (!companyId) return [];
      return await SuggestedVendorService.getPendingSuggestions(companyId);
    },
    enabled: !!companyId,
  });

  // Fetch suggestion statistics
  const { data: stats, isLoading: isLoadingStats } = useQuery<VendorSuggestionStats>({
    queryKey: ["vendor_suggestion_stats", companyId],
    queryFn: async () => {
      if (!companyId) throw new Error("Company ID required");
      return await SuggestedVendorService.getSuggestionStats(companyId);
    },
    enabled: !!companyId,
  });

  // Approve suggestion mutation
  const approveMutation = useMutation({
    mutationFn: async ({ suggestionId, finalData, reviewNotes }: {
      suggestionId: string;
      finalData: any;
      reviewNotes: string;
    }) => {
      if (!profile?.id) throw new Error("User profile required");
      return SuggestedVendorService.approveSuggestion(
        suggestionId,
        profile.id,
        finalData.name,
        finalData.email,
        finalData.phone,
        finalData.addressLine1,
        finalData.addressLine2,
        finalData.city,
        finalData.state,
        finalData.country,
        finalData.postalCode,
        finalData.website,
        undefined, // tax_id
        finalData.description,
        reviewNotes
      );
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["vendor_suggestions"] });
      queryClient.invalidateQueries({ queryKey: ["vendor_suggestion_stats"] });
      queryClient.invalidateQueries({ queryKey: ["vendors"] }); // Refresh vendors list too
      toast({ title: "Vendor Approved", description: "Vendor suggestion has been approved and created." });
      setIsApprovalDialogOpen(false);
      setCurrentSuggestion(null);
    },
    onError: (error: any) => {
      toast({ title: "Error approving vendor", description: error.message, variant: "destructive" });
    },
  });

  // Reject suggestion mutation
  const rejectMutation = useMutation({
    mutationFn: async ({ suggestionId, reviewNotes }: { suggestionId: string; reviewNotes: string }) => {
      if (!profile?.id) throw new Error("User profile required");
      return SuggestedVendorService.rejectSuggestion(suggestionId, profile.id, reviewNotes);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["vendor_suggestions"] });
      queryClient.invalidateQueries({ queryKey: ["vendor_suggestion_stats"] });
      toast({ title: "Vendor Rejected", description: "Vendor suggestion has been rejected." });
      setIsRejectDialogOpen(false);
      setCurrentSuggestion(null);
    },
    onError: (error: any) => {
      toast({ title: "Error rejecting vendor", description: error.message, variant: "destructive" });
    },
  });

  // Merge suggestions mutation
  const mergeMutation = useMutation({
    mutationFn: async ({ suggestionIds, finalName, finalEmail, finalWebsite, reviewNotes }: {
      suggestionIds: string[];
      finalName: string;
      finalEmail?: string;
      finalWebsite?: string;
      reviewNotes: string;
    }) => {
      if (!profile?.id) throw new Error("User profile required");
      return SuggestedVendorService.mergeSuggestions(
        suggestionIds,
        profile.id,
        finalName,
        finalEmail,
        undefined, // phone
        finalWebsite,
        undefined, // description
        reviewNotes
      );
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["vendor_suggestions"] });
      queryClient.invalidateQueries({ queryKey: ["vendor_suggestion_stats"] });
      queryClient.invalidateQueries({ queryKey: ["vendors"] });
      toast({ title: "Vendors Merged", description: "Vendor suggestions have been merged successfully." });
      setIsMergeDialogOpen(false);
      setSelectedSuggestions([]);
    },
    onError: (error: any) => {
      toast({ title: "Error merging vendors", description: error.message, variant: "destructive" });
    },
  });

  // Filter suggestions based on search term
  const filteredSuggestions = suggestions?.filter(suggestion =>
    suggestion.suggested_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    suggestion.suggested_email?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    suggestion.suggested_website?.toLowerCase().includes(searchTerm.toLowerCase())
  ) || [];

  // Handle approval dialog
  const handleApprove = (suggestion: SuggestedVendor) => {
    setCurrentSuggestion(suggestion);
    setApprovalData({
      name: suggestion.suggested_name,
      email: suggestion.suggested_email || "",
      phone: suggestion.suggested_phone || "",
      website: suggestion.suggested_website || "",
      addressLine1: suggestion.suggested_address_line1 || "",
      addressLine2: suggestion.suggested_address_line2 || "",
      city: suggestion.suggested_city || "",
      state: suggestion.suggested_state || "",
      country: suggestion.suggested_country || "",
      postalCode: suggestion.suggested_postal_code || "",
      description: suggestion.suggested_description || "",
      reviewNotes: ""
    });
    setIsApprovalDialogOpen(true);
  };

  // Handle reject dialog
  const handleReject = (suggestion: SuggestedVendor) => {
    setCurrentSuggestion(suggestion);
    setApprovalData(prev => ({ ...prev, reviewNotes: "" }));
    setIsRejectDialogOpen(true);
  };

  // Handle bulk selection
  const handleSelectSuggestion = (suggestionId: string) => {
    setSelectedSuggestions(prev =>
      prev.includes(suggestionId)
        ? prev.filter(id => id !== suggestionId)
        : [...prev, suggestionId]
    );
  };

  // Handle select all
  const handleSelectAll = () => {
    if (selectedSuggestions.length === filteredSuggestions.length) {
      setSelectedSuggestions([]);
    } else {
      setSelectedSuggestions(filteredSuggestions.map(s => s.id));
    }
  };

  // Get confidence color
  const getConfidenceColor = (confidence: number) => {
    if (confidence >= 0.8) return "text-green-600";
    if (confidence >= 0.6) return "text-yellow-600";
    return "text-red-600";
  };

  // Get confidence badge variant
  const getConfidenceBadge = (confidence: number) => {
    if (confidence >= 0.8) return "default";
    if (confidence >= 0.6) return "secondary";
    return "destructive";
  };

  if (isLoadingSuggestions || isLoadingStats) {
    return (
      <div className="flex flex-1 items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin" />
        <p className="ml-2">Loading vendor suggestions...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Statistics Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Pending</p>
                <p className="text-2xl font-bold">{stats?.pending || 0}</p>
              </div>
              <Clock className="h-8 w-8 text-orange-500" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Approved</p>
                <p className="text-2xl font-bold">{stats?.approved || 0}</p>
              </div>
              <CheckCircle className="h-8 w-8 text-green-500" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Web Enriched</p>
                <p className="text-2xl font-bold">{stats?.webEnrichmentSuccess || 0}</p>
              </div>
              <Globe className="h-8 w-8 text-blue-500" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Avg Confidence</p>
                <p className="text-2xl font-bold">{Math.round((stats?.avgConfidence || 0) * 100)}%</p>
              </div>
              <TrendingUp className="h-8 w-8 text-purple-500" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Main Content */}
      <Card>
        <CardHeader>
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between space-y-2 sm:space-y-0">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Building2 className="h-5 w-5" />
                Vendor Suggestions
              </CardTitle>
              <CardDescription>
                Review and approve AI-suggested vendors from Ingrid document processing
              </CardDescription>
            </div>
            <div className="flex items-center space-x-2">
              <div className="relative">
                <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search vendors..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-8 w-64"
                />
              </div>
              {selectedSuggestions.length > 0 && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setIsMergeDialogOpen(true)}
                  disabled={selectedSuggestions.length < 2}
                >
                  <Merge className="h-4 w-4 mr-1" />
                  Merge ({selectedSuggestions.length})
                </Button>
              )}
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-12">
                    <Checkbox
                      checked={selectedSuggestions.length === filteredSuggestions.length && filteredSuggestions.length > 0}
                      onCheckedChange={handleSelectAll}
                    />
                  </TableHead>
                  <TableHead>Vendor</TableHead>
                  <TableHead>Contact Info</TableHead>
                  <TableHead>Confidence</TableHead>
                  <TableHead>Usage</TableHead>
                  <TableHead>Source</TableHead>
                  <TableHead>Web Data</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredSuggestions.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={8} className="text-center text-muted-foreground py-8">
                      No vendor suggestions found.
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredSuggestions.map((suggestion) => (
                    <TableRow key={suggestion.id}>
                      <TableCell>
                        <Checkbox
                          checked={selectedSuggestions.includes(suggestion.id)}
                          onCheckedChange={() => handleSelectSuggestion(suggestion.id)}
                        />
                      </TableCell>
                      <TableCell>
                        <div className="space-y-1">
                          <div className="font-medium">{suggestion.suggested_name}</div>
                          {suggestion.suggested_description && (
                            <div className="text-sm text-muted-foreground">
                              {suggestion.suggested_description.substring(0, 60)}
                              {suggestion.suggested_description.length > 60 && "..."}
                            </div>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="space-y-1 text-sm">
                          {suggestion.suggested_email && (
                            <div className="flex items-center gap-1">
                              <Mail className="h-3 w-3" />
                              {suggestion.suggested_email}
                            </div>
                          )}
                          {suggestion.suggested_phone && (
                            <div className="flex items-center gap-1">
                              <Phone className="h-3 w-3" />
                              {suggestion.suggested_phone}
                            </div>
                          )}
                          {suggestion.suggested_website && (
                            <div className="flex items-center gap-1">
                              <ExternalLink className="h-3 w-3" />
                              <a
                                href={suggestion.suggested_website}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-blue-600 hover:underline"
                              >
                                Website
                              </a>
                            </div>
                          )}
                          {(suggestion.suggested_city || suggestion.suggested_state) && (
                            <div className="flex items-center gap-1">
                              <MapPin className="h-3 w-3" />
                              {[suggestion.suggested_city, suggestion.suggested_state].filter(Boolean).join(", ")}
                            </div>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant={getConfidenceBadge(suggestion.confidence_score)}>
                          {Math.round(suggestion.confidence_score * 100)}%
                        </Badge>
                        {suggestion.web_enrichment_confidence && (
                          <div className="text-xs text-muted-foreground mt-1">
                            Web: {Math.round(suggestion.web_enrichment_confidence * 100)}%
                          </div>
                        )}
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1">
                          <Users className="h-4 w-4" />
                          <span className="font-medium">{suggestion.usage_count}</span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="text-sm">
                          {suggestion.source_document_name && (
                            <div className="truncate max-w-32" title={suggestion.source_document_name}>
                              {suggestion.source_document_name}
                            </div>
                          )}
                          <div className="text-xs text-muted-foreground">
                            {new Date(suggestion.last_suggested_at).toLocaleDateString()}
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        {suggestion.web_enrichment_data && Object.keys(suggestion.web_enrichment_data).length > 0 ? (
                          <Badge variant="outline" className="text-blue-600">
                            <Globe className="h-3 w-3 mr-1" />
                            Enhanced
                          </Badge>
                        ) : (
                          <Badge variant="outline" className="text-gray-500">
                            Basic
                          </Badge>
                        )}
                      </TableCell>
                      <TableCell className="text-right">
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="sm">
                              <MoreHorizontal className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuLabel>Actions</DropdownMenuLabel>
                            <DropdownMenuItem onClick={() => handleApprove(suggestion)}>
                              <CheckCircle className="h-4 w-4 mr-2" />
                              Approve
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => handleReject(suggestion)}>
                              <XCircle className="h-4 w-4 mr-2" />
                              Reject
                            </DropdownMenuItem>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem
                              onClick={() => setSelectedSuggestions([suggestion.id])}
                            >
                              <Eye className="h-4 w-4 mr-2" />
                              Select for Merge
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {/* Approval Dialog */}
      <Dialog open={isApprovalDialogOpen} onOpenChange={setIsApprovalDialogOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Approve Vendor: {currentSuggestion?.suggested_name}</DialogTitle>
            <DialogDescription>
              Review and edit the vendor details before creating the vendor record.
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-4 py-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="name">Vendor Name *</Label>
                <Input
                  id="name"
                  value={approvalData.name}
                  onChange={(e) => setApprovalData(prev => ({ ...prev, name: e.target.value }))}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  value={approvalData.email}
                  onChange={(e) => setApprovalData(prev => ({ ...prev, email: e.target.value }))}
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="phone">Phone</Label>
                <Input
                  id="phone"
                  value={approvalData.phone}
                  onChange={(e) => setApprovalData(prev => ({ ...prev, phone: e.target.value }))}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="website">Website</Label>
                <Input
                  id="website"
                  value={approvalData.website}
                  onChange={(e) => setApprovalData(prev => ({ ...prev, website: e.target.value }))}
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="addressLine1">Address Line 1</Label>
              <Input
                id="addressLine1"
                value={approvalData.addressLine1}
                onChange={(e) => setApprovalData(prev => ({ ...prev, addressLine1: e.target.value }))}
              />
            </div>

            <div className="grid grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label htmlFor="city">City</Label>
                <Input
                  id="city"
                  value={approvalData.city}
                  onChange={(e) => setApprovalData(prev => ({ ...prev, city: e.target.value }))}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="state">State</Label>
                <Input
                  id="state"
                  value={approvalData.state}
                  onChange={(e) => setApprovalData(prev => ({ ...prev, state: e.target.value }))}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="country">Country</Label>
                <Input
                  id="country"
                  value={approvalData.country}
                  onChange={(e) => setApprovalData(prev => ({ ...prev, country: e.target.value }))}
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="description">Description</Label>
              <Textarea
                id="description"
                value={approvalData.description}
                onChange={(e) => setApprovalData(prev => ({ ...prev, description: e.target.value }))}
                rows={2}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="reviewNotes">Review Notes</Label>
              <Textarea
                id="reviewNotes"
                value={approvalData.reviewNotes}
                onChange={(e) => setApprovalData(prev => ({ ...prev, reviewNotes: e.target.value }))}
                placeholder="Optional notes about your approval decision..."
                rows={2}
              />
            </div>
          </div>

          <div className="flex justify-end space-x-2">
            <Button variant="outline" onClick={() => setIsApprovalDialogOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={() => {
                if (currentSuggestion) {
                  approveMutation.mutate({
                    suggestionId: currentSuggestion.id,
                    finalData: approvalData,
                    reviewNotes: approvalData.reviewNotes
                  });
                }
              }}
              disabled={!approvalData.name || approveMutation.isPending}
            >
              {approveMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Approve & Create Vendor
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Reject Dialog */}
      <AlertDialog open={isRejectDialogOpen} onOpenChange={setIsRejectDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Reject Vendor Suggestion</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to reject "{currentSuggestion?.suggested_name}"? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="space-y-2">
            <Label htmlFor="rejectNotes">Rejection Reason (Optional)</Label>
            <Textarea
              id="rejectNotes"
              value={approvalData.reviewNotes}
              onChange={(e) => setApprovalData(prev => ({ ...prev, reviewNotes: e.target.value }))}
              placeholder="Reason for rejection..."
              rows={2}
            />
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (currentSuggestion) {
                  rejectMutation.mutate({
                    suggestionId: currentSuggestion.id,
                    reviewNotes: approvalData.reviewNotes
                  });
                }
              }}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              disabled={rejectMutation.isPending}
            >
              {rejectMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Reject
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Merge Dialog */}
      <Dialog open={isMergeDialogOpen} onOpenChange={setIsMergeDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Merge Vendor Suggestions</DialogTitle>
            <DialogDescription>
              Merge {selectedSuggestions.length} vendor suggestions into a single vendor.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="mergeName">Final Vendor Name *</Label>
              <Input
                id="mergeName"
                value={approvalData.name}
                onChange={(e) => setApprovalData(prev => ({ ...prev, name: e.target.value }))}
                placeholder="Enter the final vendor name..."
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="mergeEmail">Email (Optional)</Label>
              <Input
                id="mergeEmail"
                type="email"
                value={approvalData.email}
                onChange={(e) => setApprovalData(prev => ({ ...prev, email: e.target.value }))}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="mergeWebsite">Website (Optional)</Label>
              <Input
                id="mergeWebsite"
                value={approvalData.website}
                onChange={(e) => setApprovalData(prev => ({ ...prev, website: e.target.value }))}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="mergeNotes">Merge Notes</Label>
              <Textarea
                id="mergeNotes"
                value={approvalData.reviewNotes}
                onChange={(e) => setApprovalData(prev => ({ ...prev, reviewNotes: e.target.value }))}
                placeholder="Notes about the merge decision..."
                rows={2}
              />
            </div>
          </div>

          <div className="flex justify-end space-x-2">
            <Button variant="outline" onClick={() => setIsMergeDialogOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={() => {
                mergeMutation.mutate({
                  suggestionIds: selectedSuggestions,
                  finalName: approvalData.name,
                  finalEmail: approvalData.email,
                  finalWebsite: approvalData.website,
                  reviewNotes: approvalData.reviewNotes
                });
              }}
              disabled={!approvalData.name || mergeMutation.isPending}
            >
              {mergeMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Merge & Create Vendor
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default SuggestedVendorsTab;