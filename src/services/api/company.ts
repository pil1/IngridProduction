import { BaseApiService, ApiResponse } from './base';
import { Company, Location, Vendor, Customer } from './types';

export interface CreateCompanyRequest {
  name: string;
  address?: string;
  phone?: string;
  email?: string;
  tax_id?: string;
}

export interface UpdateCompanyRequest {
  name?: string;
  address?: string;
  phone?: string;
  email?: string;
  tax_id?: string;
  is_active?: boolean;
}

export interface CompanySettings {
  currency: string;
  timezone: string;
  date_format: string;
  expense_approval_required: boolean;
  max_expense_amount: number;
  receipt_required_above: number;
}

export class CompanyService extends BaseApiService {
  // Company CRUD operations
  async getAllCompanies(): Promise<ApiResponse<Company[]>> {
    return this.handleRequest(async () => {
      return this.supabase
        .from('companies')
        .select('*')
        .order('created_at', { ascending: false });
    });
  }

  async getCompanyById(id: string): Promise<ApiResponse<Company>> {
    return this.handleRequest(async () => {
      return this.supabase
        .from('companies')
        .select('*')
        .eq('id', id)
        .single();
    });
  }

  async createCompany(company: CreateCompanyRequest): Promise<ApiResponse<Company>> {
    return this.handleRequest(async () => {
      return this.supabase
        .from('companies')
        .insert({
          ...company,
          is_active: true
        })
        .select()
        .single();
    });
  }

  async updateCompany(id: string, updates: UpdateCompanyRequest): Promise<ApiResponse<Company>> {
    return this.handleRequest(async () => {
      return this.supabase
        .from('companies')
        .update(updates)
        .eq('id', id)
        .select()
        .single();
    });
  }

  async deleteCompany(id: string): Promise<ApiResponse<void>> {
    return this.handleRequest(async () => {
      return this.supabase
        .from('companies')
        .delete()
        .eq('id', id);
    });
  }

  // Company settings
  async getCompanySettings(companyId: string): Promise<ApiResponse<CompanySettings>> {
    return this.handleRequest(async () => {
      return this.supabase
        .from('company_settings')
        .select('*')
        .eq('company_id', companyId)
        .single();
    });
  }

  async updateCompanySettings(
    companyId: string,
    settings: Partial<CompanySettings>
  ): Promise<ApiResponse<CompanySettings>> {
    return this.handleRequest(async () => {
      return this.supabase
        .from('company_settings')
        .upsert({
          company_id: companyId,
          ...settings
        })
        .select()
        .single();
    });
  }

  // Company locations
  async getCompanyLocations(companyId: string): Promise<ApiResponse<Location[]>> {
    return this.handleRequest(async () => {
      return this.supabase
        .from('locations')
        .select('*')
        .eq('company_id', companyId)
        .eq('is_active', true)
        .order('name');
    });
  }

  async createLocation(location: Omit<Location, 'id' | 'created_at' | 'updated_at'>): Promise<ApiResponse<Location>> {
    return this.handleRequest(async () => {
      return this.supabase
        .from('locations')
        .insert({
          ...location,
          is_active: true
        })
        .select()
        .single();
    });
  }

  async updateLocation(id: string, updates: Partial<Location>): Promise<ApiResponse<Location>> {
    return this.handleRequest(async () => {
      return this.supabase
        .from('locations')
        .update(updates)
        .eq('id', id)
        .select()
        .single();
    });
  }

  async deleteLocation(id: string): Promise<ApiResponse<void>> {
    return this.handleRequest(async () => {
      return this.supabase
        .from('locations')
        .delete()
        .eq('id', id);
    });
  }

  // Vendors for a company
  async getCompanyVendors(companyId: string): Promise<ApiResponse<Vendor[]>> {
    return this.handleRequest(async () => {
      return this.supabase
        .from('vendors')
        .select('*')
        .eq('company_id', companyId)
        .eq('is_active', true)
        .order('name');
    });
  }

  // Customers for a company
  async getCompanyCustomers(companyId: string): Promise<ApiResponse<Customer[]>> {
    return this.handleRequest(async () => {
      return this.supabase
        .from('customers')
        .select('*')
        .eq('company_id', companyId)
        .eq('is_active', true)
        .order('name');
    });
  }

  // Company modules and permissions
  async getCompanyModules(companyId: string): Promise<ApiResponse<any[]>> {
    return this.handleRequest(async () => {
      return this.supabase
        .from('company_modules')
        .select('*, modules(*)')
        .eq('company_id', companyId)
        .eq('is_active', true);
    });
  }

  async enableCompanyModule(companyId: string, moduleId: string): Promise<ApiResponse<any>> {
    return this.handleRequest(async () => {
      return this.supabase
        .from('company_modules')
        .upsert({
          company_id: companyId,
          module_id: moduleId,
          is_active: true
        })
        .select('*, modules(*)')
        .single();
    });
  }

  async disableCompanyModule(companyId: string, moduleId: string): Promise<ApiResponse<void>> {
    return this.handleRequest(async () => {
      return this.supabase
        .from('company_modules')
        .update({ is_active: false })
        .eq('company_id', companyId)
        .eq('module_id', moduleId);
    });
  }

  // Company notifications and email settings
  async getCompanyNotificationSettings(companyId: string): Promise<ApiResponse<any>> {
    return this.handleRequest(async () => {
      return this.supabase
        .from('company_notification_settings')
        .select('*')
        .eq('company_id', companyId)
        .single();
    });
  }

  async updateCompanyNotificationSettings(
    companyId: string,
    settings: Record<string, any>
  ): Promise<ApiResponse<any>> {
    return this.handleRequest(async () => {
      return this.supabase
        .from('company_notification_settings')
        .upsert({
          company_id: companyId,
          ...settings
        })
        .select()
        .single();
    });
  }

  async getCompanyEmailSettings(companyId: string): Promise<ApiResponse<any>> {
    return this.handleRequest(async () => {
      return this.supabase
        .from('company_email_settings')
        .select('*')
        .eq('company_id', companyId)
        .single();
    });
  }

  async updateCompanyEmailSettings(
    companyId: string,
    settings: Record<string, any>
  ): Promise<ApiResponse<any>> {
    return this.handleRequest(async () => {
      return this.supabase
        .from('company_email_settings')
        .upsert({
          company_id: companyId,
          ...settings
        })
        .select()
        .single();
    });
  }

  // Company analytics and reporting
  async getCompanyStats(companyId: string): Promise<ApiResponse<any>> {
    return this.handleRpcRequest('get_company_statistics', {
      company_id: companyId
    });
  }

  async getCompanyExpenseSummary(
    companyId: string,
    dateFrom?: string,
    dateTo?: string
  ): Promise<ApiResponse<any>> {
    return this.handleRpcRequest('get_company_expense_summary', {
      company_id: companyId,
      date_from: dateFrom,
      date_to: dateTo
    });
  }

  // Company automation settings
  async getCompanyAutomations(companyId: string): Promise<ApiResponse<any[]>> {
    return this.handleRequest(async () => {
      return this.supabase
        .from('company_automations')
        .select('*')
        .eq('company_id', companyId)
        .eq('is_active', true)
        .order('created_at', { ascending: false });
    });
  }

  async createCompanyAutomation(automation: Record<string, any>): Promise<ApiResponse<any>> {
    return this.handleRequest(async () => {
      return this.supabase
        .from('company_automations')
        .insert({
          ...automation,
          is_active: true
        })
        .select()
        .single();
    });
  }

  async updateCompanyAutomation(id: string, updates: Record<string, any>): Promise<ApiResponse<any>> {
    return this.handleRequest(async () => {
      return this.supabase
        .from('company_automations')
        .update(updates)
        .eq('id', id)
        .select()
        .single();
    });
  }

  async deleteCompanyAutomation(id: string): Promise<ApiResponse<void>> {
    return this.handleRequest(async () => {
      return this.supabase
        .from('company_automations')
        .delete()
        .eq('id', id);
    });
  }

  // File management for company
  async uploadCompanyLogo(companyId: string, file: File): Promise<ApiResponse<string>> {
    return this.handleRequest(async () => {
      const fileExt = file.name.split('.').pop();
      const fileName = `${companyId}_logo.${fileExt}`;
      const filePath = `company-logos/${fileName}`;

      const { data: uploadData, error: uploadError } = await this.supabase.storage
        .from('company-assets')
        .upload(filePath, file, { upsert: true });

      if (uploadError) throw uploadError;

      const { data } = this.supabase.storage
        .from('company-assets')
        .getPublicUrl(filePath);

      return { data: data.publicUrl, error: null };
    });
  }
}

// Create singleton instance
export const companyService = new CompanyService();