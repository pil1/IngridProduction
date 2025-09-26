/**
 * Ingrid Settings Tab
 *
 * Admin-only configuration interface for Ingrid AI settings.
 * Allows company admins and super-admins to configure AI providers,
 * API keys, and feature toggles.
 */

import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Separator } from '@/components/ui/separator';
import { useToast } from '@/hooks/use-toast';
import { usePermissions } from '@/hooks/usePermissions';
import {
  Sparkles,
  Settings,
  Shield,
  Zap,
  Brain,
  Globe,
  Eye,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  TestTube,
  DollarSign,
  Activity
} from 'lucide-react';
import { ConfigurationService } from '@/services/ingrid/ConfigurationService';
import { ingridCore } from '@/services/ingrid';
import { IngridSettingsService } from '@/services/api/ingridSettings';
import { useSession } from '@/components/SessionContextProvider';

interface IngridStatus {
  realAI: boolean;
  realOCR: boolean;
  webEnrichment: boolean;
  spireIntegration: boolean;
  provider: string;
  ocrProvider: string;
}

export default function IngridSettingsTab() {
  const { toast } = useToast();
  const { canConfigureIngrid, isSuperAdmin } = usePermissions();
  const { profile } = useSession();

  const [config, setConfig] = useState(ConfigurationService.getConfig());
  const [status, setStatus] = useState<IngridStatus>(ConfigurationService.getConfigurationStatus());
  const [isValidating, setIsValidating] = useState(false);
  const [isTesting, setIsTesting] = useState(false);
  const [testResult, setTestResult] = useState<string | null>(null);
  const [apiKeyVisible, setApiKeyVisible] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  // Load company AI settings on component mount
  useEffect(() => {
    const loadCompanySettings = async () => {
      if (!profile?.company_id) {
        setIsLoading(false);
        return;
      }

      try {
        const settings = await IngridSettingsService.getCompanyAISettings(profile.company_id);

        // Merge database settings with local config
        if (settings.openai_api_key || settings.ai_provider || settings.ai_model) {
          const updates: Record<string, any> = {};

          if (settings.openai_api_key) {
            updates.apiKey = settings.openai_api_key;
          }
          if (settings.ai_provider) {
            updates.provider = settings.ai_provider;
          }
          if (settings.ai_model) {
            updates.model = settings.ai_model;
          }
          if (settings.ocr_provider) {
            updates.ocrProvider = settings.ocr_provider;
          }
          if (settings.enable_web_enrichment !== undefined) {
            updates.enableWebEnrichment = settings.enable_web_enrichment;
          }
          if (settings.enable_spire_integration !== undefined) {
            updates.enableSPIREIntegration = settings.enable_spire_integration;
          }
          if (settings.auto_approval_threshold !== undefined) {
            updates.autoApprovalThreshold = settings.auto_approval_threshold;
          }
          if (settings.google_vision_api_key) {
            updates.googleVisionApiKey = settings.google_vision_api_key;
          }
          if (settings.aws_access_key_id) {
            updates.awsAccessKeyId = settings.aws_access_key_id;
          }
          if (settings.aws_secret_access_key) {
            updates.awsSecretAccessKey = settings.aws_secret_access_key;
          }
          if (settings.aws_region) {
            updates.awsRegion = settings.aws_region;
          }
          if (settings.azure_api_key) {
            updates.azureApiKey = settings.azure_api_key;
          }
          if (settings.azure_endpoint) {
            updates.azureEndpoint = settings.azure_endpoint;
          }

          if (Object.keys(updates).length > 0) {
            const newConfig = ConfigurationService.saveConfig(updates);
            setConfig(newConfig);
            setStatus(ConfigurationService.getConfigurationStatus());
          }
        }
      } catch (error) {
        console.error('Failed to load company AI settings:', error);
        toast({
          title: "Settings Load Error",
          description: "Failed to load AI settings from database. Using local settings.",
          variant: "destructive"
        });
      } finally {
        setIsLoading(false);
      }
    };

    loadCompanySettings();
  }, [profile?.company_id, toast]);

  // Check permissions
  if (!canConfigureIngrid) {
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
              You don't have permission to configure Ingrid AI settings.
              Only company administrators can access these settings.
            </AlertDescription>
          </Alert>
        </CardContent>
      </Card>
    );
  }

  const updateConfig = async (updates: Partial<typeof config>) => {
    const newConfig = ConfigurationService.saveConfig(updates);
    setConfig(newConfig);
    setStatus(ConfigurationService.getConfigurationStatus());

    // Also save to database if user has a company
    if (profile?.company_id) {
      try {
        setIsSaving(true);

        const dbUpdates: Record<string, any> = {};

        if ('apiKey' in updates) {
          dbUpdates.openai_api_key = updates.apiKey;
        }
        if ('provider' in updates) {
          dbUpdates.ai_provider = updates.provider;
        }
        if ('model' in updates) {
          dbUpdates.ai_model = updates.model;
        }
        if ('ocrProvider' in updates) {
          dbUpdates.ocr_provider = updates.ocrProvider;
        }
        if ('enableWebEnrichment' in updates) {
          dbUpdates.enable_web_enrichment = updates.enableWebEnrichment;
        }
        if ('enableSPIREIntegration' in updates) {
          dbUpdates.enable_spire_integration = updates.enableSPIREIntegration;
        }
        if ('autoApprovalThreshold' in updates) {
          dbUpdates.auto_approval_threshold = updates.autoApprovalThreshold;
        }
        if ('googleVisionApiKey' in updates) {
          dbUpdates.google_vision_api_key = updates.googleVisionApiKey;
        }
        if ('awsAccessKeyId' in updates) {
          dbUpdates.aws_access_key_id = updates.awsAccessKeyId;
        }
        if ('awsSecretAccessKey' in updates) {
          dbUpdates.aws_secret_access_key = updates.awsSecretAccessKey;
        }
        if ('awsRegion' in updates) {
          dbUpdates.aws_region = updates.awsRegion;
        }
        if ('azureApiKey' in updates) {
          dbUpdates.azure_api_key = updates.azureApiKey;
        }
        if ('azureEndpoint' in updates) {
          dbUpdates.azure_endpoint = updates.azureEndpoint;
        }

        if (Object.keys(dbUpdates).length > 0) {
          await IngridSettingsService.updateCompanyAISettings(profile.company_id, dbUpdates);
        }
      } catch (error) {
        console.error('Failed to save settings to database:', error);
        toast({
          title: "Save Error",
          description: "Settings saved locally but failed to sync to database.",
          variant: "destructive"
        });
      } finally {
        setIsSaving(false);
      }
    }
  };

  const handleEnableRealAI = async () => {
    if (!config.apiKey) {
      toast({
        title: "API Key Required",
        description: "Please enter an OpenAI API key to enable real AI features.",
        variant: "destructive"
      });
      return;
    }

    setIsValidating(true);
    try {
      const isValid = await ConfigurationService.validateOpenAIKey(config.apiKey);

      if (isValid) {
        const newConfig = ConfigurationService.enableOpenAI(config.apiKey);
        setConfig(newConfig);
        setStatus(ConfigurationService.getConfigurationStatus());

        // Save to database
        if (profile?.company_id) {
          try {
            await IngridSettingsService.updateCompanyAISettings(profile.company_id, {
              openai_api_key: config.apiKey,
              ai_provider: 'openai',
              ai_enabled: true
            });
          } catch (dbError) {
            console.error('Failed to save AI settings to database:', dbError);
          }
        }

        toast({
          title: "Real AI Enabled",
          description: "Ingrid is now using OpenAI GPT-4 and Vision APIs for enhanced intelligence.",
        });
      } else {
        toast({
          title: "Invalid API Key",
          description: "The provided OpenAI API key is not valid. Please check and try again.",
          variant: "destructive"
        });
      }
    } catch {
      toast({
        title: "Validation Failed",
        description: "Unable to validate API key. Please check your internet connection.",
        variant: "destructive"
      });
    } finally {
      setIsValidating(false);
    }
  };

  const handleDisableRealAI = async () => {
    const newConfig = ConfigurationService.enableMockMode();
    setConfig(newConfig);
    setStatus(ConfigurationService.getConfigurationStatus());

    // Save to database
    if (profile?.company_id) {
      try {
        await IngridSettingsService.updateCompanyAISettings(profile.company_id, {
          ai_provider: 'mock',
          ai_enabled: false
        });
      } catch (dbError) {
        console.error('Failed to save AI settings to database:', dbError);
      }
    }

    toast({
      title: "Mock Mode Enabled",
      description: "Ingrid is now using sophisticated mock services instead of real AI.",
    });
  };

  const handleTestConfiguration = async () => {
    setIsTesting(true);
    setTestResult(null);

    try {
      // Create a test document to verify the configuration works
      const testFile = new File(['Test receipt content'], 'test-receipt.txt', { type: 'text/plain' });

      const response = await ingridCore.processDocument({
        document: testFile,
        context: 'expense_creation',
        userMessage: 'Test configuration'
      });

      if (response.actionCards.length > 0) {
        setTestResult('success');
        toast({
          title: "Configuration Test Successful",
          description: `Ingrid processed the test document and generated ${response.actionCards.length} action cards.`,
        });
      } else {
        setTestResult('warning');
        toast({
          title: "Configuration Test Completed",
          description: "Ingrid processed the test document but generated no action cards.",
          variant: "destructive"
        });
      }
    } catch {
      setTestResult('error');
      toast({
        title: "Configuration Test Failed",
        description: "Unable to test Ingrid configuration. Please check your settings.",
        variant: "destructive"
      });
    } finally {
      setIsTesting(false);
    }
  };

  const resetToDefaults = () => {
    const newConfig = ConfigurationService.resetToDefaults();
    setConfig(newConfig);
    setStatus(ConfigurationService.getConfigurationStatus());

    toast({
      title: "Settings Reset",
      description: "Ingrid configuration has been reset to default values.",
    });
  };

  if (isLoading) {
    return (
      <div className="flex flex-1 items-center justify-center p-8">
        <Activity className="h-8 w-8 animate-spin mr-2" />
        <p>Loading AI settings...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Status Overview */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-blue-500" />
            Ingrid AI Status
          </CardTitle>
          <CardDescription>
            Current status of Ingrid AI features and capabilities
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="flex items-center gap-2">
              <Brain className="h-4 w-4" />
              <span className="text-sm">AI Provider:</span>
              <Badge variant={status.realAI ? "default" : "secondary"}>
                {status.realAI ? 'OpenAI GPT-4' : 'Mock AI'}
              </Badge>
            </div>
            <div className="flex items-center gap-2">
              <Eye className="h-4 w-4" />
              <span className="text-sm">OCR:</span>
              <Badge variant={status.realOCR ? "default" : "secondary"}>
                {status.realOCR ? 'Real' : 'Mock'}
              </Badge>
            </div>
            <div className="flex items-center gap-2">
              <Globe className="h-4 w-4" />
              <span className="text-sm">Web Enrichment:</span>
              <Badge variant={status.webEnrichment ? "default" : "secondary"}>
                {status.webEnrichment ? 'Enabled' : 'Disabled'}
              </Badge>
            </div>
            <div className="flex items-center gap-2">
              <Activity className="h-4 w-4" />
              <span className="text-sm">SPIRE Integration:</span>
              <Badge variant={status.spireIntegration ? "default" : "secondary"}>
                {status.spireIntegration ? 'Enabled' : 'Disabled'}
              </Badge>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* AI Provider Configuration */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Brain className="h-5 w-5 text-purple-500" />
            AI Provider Settings
          </CardTitle>
          <CardDescription>
            Configure AI providers and API credentials for enhanced intelligence
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* API Key Management Notification */}
          <Alert>
            <Shield className="h-4 w-4" />
            <AlertDescription>
              <strong>API Key Management:</strong> API keys for OpenAI and other AI services are now managed centrally by super-administrators.
              Contact your super-admin to provision or update API keys for your company.
              {status.realAI ? (
                <div className="mt-2 flex items-center gap-2">
                  <CheckCircle2 className="h-4 w-4 text-green-600" />
                  <span className="text-sm font-medium text-green-700">OpenAI API key is active and configured</span>
                </div>
              ) : (
                <div className="mt-2 flex items-center gap-2">
                  <XCircle className="h-4 w-4 text-amber-600" />
                  <span className="text-sm font-medium text-amber-700">No OpenAI API key configured for your company</span>
                </div>
              )}
            </AlertDescription>
          </Alert>

          {/* Model Configuration */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="model">AI Model</Label>
              <Select
                value={config.model}
                onValueChange={(value) => updateConfig({ model: value })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="gpt-4">GPT-4 (Recommended)</SelectItem>
                  <SelectItem value="gpt-4-turbo">GPT-4 Turbo</SelectItem>
                  <SelectItem value="gpt-3.5-turbo">GPT-3.5 Turbo</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="ocr-provider">OCR Provider</Label>
              <Select
                value={config.ocrProvider}
                onValueChange={(value: any) => updateConfig({ ocrProvider: value })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="mock">Mock OCR</SelectItem>
                  <SelectItem value="openai-vision">OpenAI Vision</SelectItem>
                  <SelectItem value="google-vision">Google Cloud Vision</SelectItem>
                  <SelectItem value="aws-textract">AWS Textract</SelectItem>
                  <SelectItem value="azure-document">Azure Document Intelligence</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* OCR Provider API Keys - Notification */}
          {config.ocrProvider === 'google-vision' && (
            <div className="space-y-3 p-4 border rounded-lg bg-muted/20">
              <h4 className="font-medium text-sm">Google Cloud Vision Configuration</h4>
              <Alert>
                <Shield className="h-4 w-4" />
                <AlertDescription>
                  Google Vision API keys are managed by super-administrators.
                  Contact your super-admin to configure OCR processing credentials.
                </AlertDescription>
              </Alert>
            </div>
          )}

          {config.ocrProvider === 'aws-textract' && (
            <div className="space-y-3 p-4 border rounded-lg bg-muted/20">
              <h4 className="font-medium text-sm">AWS Textract Configuration</h4>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="aws-access-key">AWS Access Key ID</Label>
                  <Input
                    id="aws-access-key"
                    type="password"
                    placeholder="AKIA..."
                    value={config.awsAccessKeyId ?? ''}
                    onChange={(e) => updateConfig({ awsAccessKeyId: e.target.value })}
                    disabled={isSaving}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="aws-secret-key">AWS Secret Access Key</Label>
                  <Input
                    id="aws-secret-key"
                    type="password"
                    placeholder="..."
                    value={config.awsSecretAccessKey ?? ''}
                    onChange={(e) => updateConfig({ awsSecretAccessKey: e.target.value })}
                    disabled={isSaving}
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="aws-region">AWS Region</Label>
                <Select
                  value={config.awsRegion ?? 'us-east-1'}
                  onValueChange={(value) => updateConfig({ awsRegion: value })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select AWS region" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="us-east-1">US East (N. Virginia)</SelectItem>
                    <SelectItem value="us-west-2">US West (Oregon)</SelectItem>
                    <SelectItem value="eu-west-1">Europe (Ireland)</SelectItem>
                    <SelectItem value="ap-southeast-1">Asia Pacific (Singapore)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <p className="text-xs text-muted-foreground">
                Configure your AWS credentials for Textract document processing.
              </p>
            </div>
          )}

          {config.ocrProvider === 'azure-document' && (
            <div className="space-y-3 p-4 border rounded-lg bg-muted/20">
              <h4 className="font-medium text-sm">Azure Document Intelligence Configuration</h4>
              <Alert>
                <Shield className="h-4 w-4" />
                <AlertDescription>
                  Azure Document Intelligence API keys are managed by super-administrators.
                  Contact your super-admin to configure OCR processing credentials.
                </AlertDescription>
              </Alert>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Feature Toggles */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Zap className="h-5 w-5 text-yellow-500" />
            Feature Configuration
          </CardTitle>
          <CardDescription>
            Enable or disable specific Ingrid AI features
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label htmlFor="web-enrichment">Web Enrichment</Label>
              <p className="text-xs text-muted-foreground">
                Automatically enrich documents with company and vendor information
              </p>
            </div>
            <Switch
              id="web-enrichment"
              checked={config.enableWebEnrichment}
              onCheckedChange={(checked) => updateConfig({ enableWebEnrichment: checked })}
            />
          </div>

          <Separator />

          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label htmlFor="spire-integration">SPIRE Integration</Label>
              <p className="text-xs text-muted-foreground">
                Enable integration with SPIRE business intelligence system
              </p>
            </div>
            <Switch
              id="spire-integration"
              checked={config.enableSPIREIntegration}
              onCheckedChange={(checked) => updateConfig({ enableSPIREIntegration: checked })}
            />
          </div>

          <Separator />

          <div className="space-y-2">
            <Label htmlFor="approval-threshold">Auto-Approval Threshold</Label>
            <div className="flex items-center gap-2">
              <Input
                id="approval-threshold"
                type="number"
                min="0"
                max="1"
                step="0.05"
                value={config.autoApprovalThreshold}
                onChange={(e) => updateConfig({ autoApprovalThreshold: parseFloat(e.target.value) })}
                className="w-24"
              />
              <span className="text-sm text-muted-foreground">
                ({Math.round(config.autoApprovalThreshold * 100)}% confidence)
              </span>
            </div>
            <p className="text-xs text-muted-foreground">
              Actions with confidence above this threshold will be auto-approved
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Testing & Validation */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <TestTube className="h-5 w-5 text-green-500" />
            Testing & Validation
          </CardTitle>
          <CardDescription>
            Test your Ingrid configuration to ensure everything works correctly
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex gap-2">
            <Button
              onClick={handleTestConfiguration}
              disabled={isTesting}
              variant="outline"
            >
              {isTesting ? (
                <Activity className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <TestTube className="h-4 w-4 mr-2" />
              )}
              {isTesting ? 'Testing...' : 'Test Configuration'}
            </Button>

            {isSuperAdmin && (
              <Button
                onClick={resetToDefaults}
                variant="outline"
              >
                <Settings className="h-4 w-4 mr-2" />
                Reset to Defaults
              </Button>
            )}
          </div>

          {testResult && (
            <Alert variant={testResult === 'success' ? 'default' : 'destructive'}>
              {testResult === 'success' ? (
                <CheckCircle2 className="h-4 w-4" />
              ) : testResult === 'warning' ? (
                <AlertTriangle className="h-4 w-4" />
              ) : (
                <XCircle className="h-4 w-4" />
              )}
              <AlertDescription>
                {testResult === 'success' && 'Configuration test completed successfully. Ingrid AI is working correctly.'}
                {testResult === 'warning' && 'Configuration test completed with warnings. Some features may not be working optimally.'}
                {testResult === 'error' && 'Configuration test failed. Please check your settings and try again.'}
              </AlertDescription>
            </Alert>
          )}
        </CardContent>
      </Card>

      {/* Usage & Cost Information */}
      {status.realAI && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <DollarSign className="h-5 w-5 text-blue-500" />
              Usage & Cost Monitoring
            </CardTitle>
            <CardDescription>
              Monitor API usage and associated costs
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Alert>
              <AlertTriangle className="h-4 w-4" />
              <AlertDescription>
                Real AI features use external APIs which may incur costs. Monitor your usage regularly
                and set up billing alerts in your OpenAI account to avoid unexpected charges.
              </AlertDescription>
            </Alert>
          </CardContent>
        </Card>
      )}
    </div>
  );
}