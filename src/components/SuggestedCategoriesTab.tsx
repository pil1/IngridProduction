/**
 * Suggested Categories Tab for Expense Categories Page
 *
 * Allows controllers to review, approve, reject, and merge AI-suggested expense categories.
 * Provides bulk operations and detailed analytics on suggestion patterns.
 */

import React, { useState, useCallback } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Separator } from '@/components/ui/separator';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  CheckCircle,
  XCircle,
  Clock,
  MoreHorizontal,
  Sparkles,
  TrendingUp,
  Users,
  Target,
  Merge,
  Eye,
  Plus
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useSession } from '@/components/SessionContextProvider';
import { SuggestedCategoryService, type SuggestedCategory } from '@/services/ingrid/SuggestedCategoryService';

interface SuggestedCategoriesTabProps {
  companyId: string;
}

export const SuggestedCategoriesTab: React.FC<SuggestedCategoriesTabProps> = ({ companyId }) => {
  const { toast } = useToast();
  const { profile } = useSession();
  const queryClient = useQueryClient();

  const [selectedSuggestions, setSelectedSuggestions] = useState<string[]>([]);
  const [approvalDialogOpen, setApprovalDialogOpen] = useState(false);
  const [mergeDialogOpen, setMergeDialogOpen] = useState(false);
  const [currentSuggestion, setCurrentSuggestion] = useState<SuggestedCategory | null>(null);

  // Fetch pending suggestions
  const { data: pendingSuggestions = [], isLoading, error } = useQuery({
    queryKey: ['suggested-categories', companyId],
    queryFn: () => SuggestedCategoryService.getPendingSuggestions(companyId),
    enabled: !!companyId
  });

  // Fetch suggestion statistics
  const { data: stats } = useQuery({
    queryKey: ['suggested-categories-stats', companyId],
    queryFn: () => SuggestedCategoryService.getSuggestionStats(companyId),
    enabled: !!companyId
  });

  // Approve suggestion mutation
  const approveMutation = useMutation({
    mutationFn: async ({
      suggestionId,
      finalName,
      finalDescription,
      glAccountId,
      reviewNotes
    }: {
      suggestionId: string;
      finalName?: string;
      finalDescription?: string;
      glAccountId?: string;
      reviewNotes?: string;
    }) => {
      if (!profile?.id) throw new Error('User not authenticated');

      return SuggestedCategoryService.approveSuggestion(
        suggestionId,
        profile.id,
        finalName,
        finalDescription,
        glAccountId,
        reviewNotes
      );
    },
    onSuccess: (result) => {
      toast({
        title: "Category Approved",
        description: `Successfully created category and approved suggestion.`
      });
      queryClient.invalidateQueries({ queryKey: ['suggested-categories', companyId] });
      queryClient.invalidateQueries({ queryKey: ['expense_categories', companyId] });
      setApprovalDialogOpen(false);
      setCurrentSuggestion(null);
    },
    onError: (error) => {
      toast({
        title: "Approval Failed",
        description: error instanceof Error ? error.message : 'Failed to approve suggestion',
        variant: "destructive"
      });
    }
  });

  // Reject suggestion mutation
  const rejectMutation = useMutation({
    mutationFn: async ({ suggestionId, reviewNotes }: { suggestionId: string; reviewNotes?: string }) => {
      if (!profile?.id) throw new Error('User not authenticated');
      return SuggestedCategoryService.rejectSuggestion(suggestionId, profile.id, reviewNotes);
    },
    onSuccess: () => {
      toast({
        title: "Suggestion Rejected",
        description: "Successfully rejected the category suggestion."
      });
      queryClient.invalidateQueries({ queryKey: ['suggested-categories', companyId] });
    },
    onError: (error) => {
      toast({
        title: "Rejection Failed",
        description: error instanceof Error ? error.message : 'Failed to reject suggestion',
        variant: "destructive"
      });
    }
  });

  // Merge suggestions mutation
  const mergeMutation = useMutation({
    mutationFn: async ({
      suggestionIds,
      finalName,
      finalDescription,
      glAccountId,
      reviewNotes
    }: {
      suggestionIds: string[];
      finalName: string;
      finalDescription?: string;
      glAccountId?: string;
      reviewNotes?: string;
    }) => {
      if (!profile?.id) throw new Error('User not authenticated');

      return SuggestedCategoryService.mergeSuggestions(
        suggestionIds,
        profile.id,
        finalName,
        finalDescription,
        glAccountId,
        reviewNotes
      );
    },
    onSuccess: (result) => {
      toast({
        title: "Suggestions Merged",
        description: `Successfully merged ${selectedSuggestions.length} suggestions into one category.`
      });
      queryClient.invalidateQueries({ queryKey: ['suggested-categories', companyId] });
      queryClient.invalidateQueries({ queryKey: ['expense_categories', companyId] });
      setMergeDialogOpen(false);
      setSelectedSuggestions([]);
    },
    onError: (error) => {
      toast({
        title: "Merge Failed",
        description: error instanceof Error ? error.message : 'Failed to merge suggestions',
        variant: "destructive"
      });
    }
  });

  const handleApprove = useCallback((suggestion: SuggestedCategory) => {
    setCurrentSuggestion(suggestion);
    setApprovalDialogOpen(true);
  }, []);

  const handleReject = useCallback((suggestionId: string) => {
    rejectMutation.mutate({
      suggestionId,
      reviewNotes: 'Rejected by controller'
    });
  }, [rejectMutation]);

  const handleBulkReject = useCallback(() => {
    selectedSuggestions.forEach(suggestionId => {
      rejectMutation.mutate({
        suggestionId,
        reviewNotes: 'Bulk rejected by controller'
      });
    });
    setSelectedSuggestions([]);
  }, [selectedSuggestions, rejectMutation]);

  const handleMerge = useCallback(() => {
    if (selectedSuggestions.length < 2) {
      toast({
        title: "Selection Required",
        description: "Please select at least 2 suggestions to merge.",
        variant: "destructive"
      });
      return;
    }
    setMergeDialogOpen(true);
  }, [selectedSuggestions, toast]);

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'pending':
        return <Badge variant="outline" className="text-yellow-600"><Clock className="w-3 h-3 mr-1" />Pending</Badge>;
      case 'approved':
        return <Badge variant="outline" className="text-green-600"><CheckCircle className="w-3 h-3 mr-1" />Approved</Badge>;
      case 'rejected':
        return <Badge variant="outline" className="text-red-600"><XCircle className="w-3 h-3 mr-1" />Rejected</Badge>;
      case 'merged':
        return <Badge variant="outline" className="text-blue-600"><Merge className="w-3 h-3 mr-1" />Merged</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  const getConfidenceBadge = (confidence: number) => {
    if (confidence >= 0.8) {
      return <Badge variant="outline" className="text-green-600">High ({Math.round(confidence * 100)}%)</Badge>;
    } else if (confidence >= 0.6) {
      return <Badge variant="outline" className="text-yellow-600">Medium ({Math.round(confidence * 100)}%)</Badge>;
    } else {
      return <Badge variant="outline" className="text-red-600">Low ({Math.round(confidence * 100)}%)</Badge>;
    }
  };

  if (isLoading) {
    return <div className="flex items-center justify-center p-8">Loading suggested categories...</div>;
  }

  if (error) {
    return (
      <Alert>
        <AlertDescription>
          Failed to load suggested categories. Please try refreshing the page.
        </AlertDescription>
      </Alert>
    );
  }

  return (
    <div className="space-y-6">
      {/* Statistics Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Pending Review</CardTitle>
            <Clock className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats?.pending || 0}</div>
            <p className="text-xs text-muted-foreground">
              Awaiting your approval
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Approved</CardTitle>
            <CheckCircle className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats?.approved || 0}</div>
            <p className="text-xs text-muted-foreground">
              Categories created
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Avg Confidence</CardTitle>
            <Target className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{Math.round((stats?.avgConfidence || 0) * 100)}%</div>
            <p className="text-xs text-muted-foreground">
              AI suggestion quality
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Suggestions</CardTitle>
            <Sparkles className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats?.total || 0}</div>
            <p className="text-xs text-muted-foreground">
              All time suggestions
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Main Content */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Sparkles className="h-5 w-5" />
                AI Suggested Categories
              </CardTitle>
              <CardDescription>
                Review and approve category suggestions generated by Ingrid AI
              </CardDescription>
            </div>
            <div className="flex gap-2">
              {selectedSuggestions.length > 0 && (
                <>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleBulkReject}
                    disabled={rejectMutation.isPending}
                  >
                    <XCircle className="w-4 h-4 mr-2" />
                    Reject Selected ({selectedSuggestions.length})
                  </Button>
                  {selectedSuggestions.length > 1 && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={handleMerge}
                      disabled={mergeMutation.isPending}
                    >
                      <Merge className="w-4 h-4 mr-2" />
                      Merge Selected ({selectedSuggestions.length})
                    </Button>
                  )}
                </>
              )}
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {pendingSuggestions.length === 0 ? (
            <div className="text-center py-8">
              <Sparkles className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
              <h3 className="text-lg font-medium mb-2">No pending suggestions</h3>
              <p className="text-muted-foreground">
                Ingrid AI will suggest new categories as users process expenses with unfamiliar categories.
              </p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-12">
                    <Checkbox
                      checked={selectedSuggestions.length === pendingSuggestions.length}
                      onCheckedChange={(checked) => {
                        if (checked) {
                          setSelectedSuggestions(pendingSuggestions.map(s => s.id));
                        } else {
                          setSelectedSuggestions([]);
                        }
                      }}
                    />
                  </TableHead>
                  <TableHead>Category Name</TableHead>
                  <TableHead>Usage Count</TableHead>
                  <TableHead>Confidence</TableHead>
                  <TableHead>Context</TableHead>
                  <TableHead>First Seen</TableHead>
                  <TableHead className="w-20">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {pendingSuggestions.map((suggestion) => (
                  <TableRow key={suggestion.id}>
                    <TableCell>
                      <Checkbox
                        checked={selectedSuggestions.includes(suggestion.id)}
                        onCheckedChange={(checked) => {
                          if (checked) {
                            setSelectedSuggestions(prev => [...prev, suggestion.id]);
                          } else {
                            setSelectedSuggestions(prev => prev.filter(id => id !== suggestion.id));
                          }
                        }}
                      />
                    </TableCell>
                    <TableCell className="font-medium">
                      <div>
                        <div className="font-medium">{suggestion.suggested_name}</div>
                        {suggestion.suggested_description && (
                          <div className="text-sm text-muted-foreground">
                            {suggestion.suggested_description}
                          </div>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant="secondary">{suggestion.usage_count}×</Badge>
                    </TableCell>
                    <TableCell>
                      {getConfidenceBadge(suggestion.confidence_score)}
                    </TableCell>
                    <TableCell>
                      <div className="text-sm">
                        {suggestion.vendor_context && (
                          <div>Vendor: {suggestion.vendor_context}</div>
                        )}
                        {suggestion.amount_context && (
                          <div>Amount: ${suggestion.amount_context}</div>
                        )}
                      </div>
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {new Date(suggestion.first_suggested_at).toLocaleDateString()}
                    </TableCell>
                    <TableCell>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" className="h-8 w-8 p-0">
                            <MoreHorizontal className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuLabel>Actions</DropdownMenuLabel>
                          <DropdownMenuItem
                            onClick={() => handleApprove(suggestion)}
                            disabled={approveMutation.isPending}
                          >
                            <CheckCircle className="w-4 h-4 mr-2" />
                            Approve
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            onClick={() => handleReject(suggestion.id)}
                            disabled={rejectMutation.isPending}
                          >
                            <XCircle className="w-4 h-4 mr-2" />
                            Reject
                          </DropdownMenuItem>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem>
                            <Eye className="w-4 h-4 mr-2" />
                            View Details
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Approval Dialog */}
      <Dialog open={approvalDialogOpen} onOpenChange={setApprovalDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Approve Category Suggestion</DialogTitle>
            <DialogDescription>
              Review and customize the suggested category before approving.
            </DialogDescription>
          </DialogHeader>

          {currentSuggestion && (
            <ApprovalForm
              suggestion={currentSuggestion}
              onSubmit={(data) => {
                approveMutation.mutate({
                  suggestionId: currentSuggestion.id,
                  ...data
                });
              }}
              isSubmitting={approveMutation.isPending}
            />
          )}
        </DialogContent>
      </Dialog>

      {/* Merge Dialog */}
      <Dialog open={mergeDialogOpen} onOpenChange={setMergeDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Merge Category Suggestions</DialogTitle>
            <DialogDescription>
              Combine {selectedSuggestions.length} similar suggestions into one category.
            </DialogDescription>
          </DialogHeader>

          <MergeForm
            suggestions={pendingSuggestions.filter(s => selectedSuggestions.includes(s.id))}
            onSubmit={(data) => {
              mergeMutation.mutate({
                suggestionIds: selectedSuggestions,
                ...data
              });
            }}
            isSubmitting={mergeMutation.isPending}
          />
        </DialogContent>
      </Dialog>
    </div>
  );
};

// Approval Form Component
interface ApprovalFormProps {
  suggestion: SuggestedCategory;
  onSubmit: (data: { finalName?: string; finalDescription?: string; reviewNotes?: string }) => void;
  isSubmitting: boolean;
}

const ApprovalForm: React.FC<ApprovalFormProps> = ({ suggestion, onSubmit, isSubmitting }) => {
  const [finalName, setFinalName] = useState(suggestion.suggested_name);
  const [finalDescription, setFinalDescription] = useState(suggestion.suggested_description || '');
  const [reviewNotes, setReviewNotes] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit({
      finalName: finalName !== suggestion.suggested_name ? finalName : undefined,
      finalDescription: finalDescription !== suggestion.suggested_description ? finalDescription : undefined,
      reviewNotes: reviewNotes || undefined
    });
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="finalName">Category Name</Label>
        <Input
          id="finalName"
          value={finalName}
          onChange={(e) => setFinalName(e.target.value)}
          placeholder="Category name"
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="finalDescription">Description (Optional)</Label>
        <Textarea
          id="finalDescription"
          value={finalDescription}
          onChange={(e) => setFinalDescription(e.target.value)}
          placeholder="Category description"
          rows={2}
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="reviewNotes">Review Notes (Optional)</Label>
        <Textarea
          id="reviewNotes"
          value={reviewNotes}
          onChange={(e) => setReviewNotes(e.target.value)}
          placeholder="Optional notes about this approval"
          rows={2}
        />
      </div>

      <DialogFooter>
        <Button
          type="submit"
          disabled={isSubmitting || !finalName.trim()}
        >
          {isSubmitting ? 'Approving...' : 'Approve & Create Category'}
        </Button>
      </DialogFooter>
    </form>
  );
};

// Merge Form Component
interface MergeFormProps {
  suggestions: SuggestedCategory[];
  onSubmit: (data: { finalName: string; finalDescription?: string; reviewNotes?: string }) => void;
  isSubmitting: boolean;
}

const MergeForm: React.FC<MergeFormProps> = ({ suggestions, onSubmit, isSubmitting }) => {
  const [finalName, setFinalName] = useState('');
  const [finalDescription, setFinalDescription] = useState('');
  const [reviewNotes, setReviewNotes] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit({
      finalName,
      finalDescription: finalDescription || undefined,
      reviewNotes: reviewNotes || undefined
    });
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="space-y-2">
        <Label>Suggestions to Merge</Label>
        <div className="space-y-1">
          {suggestions.map((suggestion) => (
            <div key={suggestion.id} className="text-sm bg-muted p-2 rounded">
              <span className="font-medium">{suggestion.suggested_name}</span>
              <span className="text-muted-foreground ml-2">({suggestion.usage_count}× used)</span>
            </div>
          ))}
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="finalName">Final Category Name *</Label>
        <Input
          id="finalName"
          value={finalName}
          onChange={(e) => setFinalName(e.target.value)}
          placeholder="Enter the final category name"
          required
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="finalDescription">Description (Optional)</Label>
        <Textarea
          id="finalDescription"
          value={finalDescription}
          onChange={(e) => setFinalDescription(e.target.value)}
          placeholder="Category description"
          rows={2}
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="reviewNotes">Merge Notes (Optional)</Label>
        <Textarea
          id="reviewNotes"
          value={reviewNotes}
          onChange={(e) => setReviewNotes(e.target.value)}
          placeholder="Optional notes about this merge"
          rows={2}
        />
      </div>

      <DialogFooter>
        <Button
          type="submit"
          disabled={isSubmitting || !finalName.trim()}
        >
          {isSubmitting ? 'Merging...' : `Merge ${suggestions.length} Suggestions`}
        </Button>
      </DialogFooter>
    </form>
  );
};