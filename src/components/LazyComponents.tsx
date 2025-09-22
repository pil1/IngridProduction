import React from 'react';

// Direct imports for now - lazy loading can be enabled later when needed
import AddEditExpenseDialog from './AddEditExpenseDialog';
import AddEditAutomationDialog from './AddEditAutomationDialog';
import CompanySetupDialog from './CompanySetupDialog';
import AiRedesignTemplateDialog from './AiRedesignTemplateDialog';
import SmartAddDialog from './SmartAddDialog';
import AvatarCropDialog from './AvatarCropDialog';
import AddEditVendorDialog from './AddEditVendorDialog';
import AddEditCustomerDialog from './AddEditCustomerDialog';
import AddEditLocationDialog from './AddEditLocationDialog';
import InviteUserDialog from './InviteUserDialog';
import ExportDialog from './ExportDialog';
import RichTextEditor from './RichTextEditor';
import ReceiptUpload from './ReceiptUpload';



// Direct component wrappers (no lazy loading for now)
export const LazyAddEditExpenseDialog: React.FC<React.ComponentProps<typeof AddEditExpenseDialog>> = (props) => (
  <AddEditExpenseDialog {...props} />
);

export const LazyAddEditAutomationDialog: React.FC<React.ComponentProps<typeof AddEditAutomationDialog>> = (props) => (
  <AddEditAutomationDialog {...props} />
);

export const LazyCompanySetupDialog: React.FC<React.ComponentProps<typeof CompanySetupDialog>> = (props) => (
  <CompanySetupDialog {...props} />
);

export const LazyAiRedesignTemplateDialog: React.FC<React.ComponentProps<typeof AiRedesignTemplateDialog>> = (props) => (
  <AiRedesignTemplateDialog {...props} />
);

export const LazySmartAddDialog: React.FC<React.ComponentProps<typeof SmartAddDialog>> = (props) => (
  <SmartAddDialog {...props} />
);

export const LazyAvatarCropDialog: React.FC<React.ComponentProps<typeof AvatarCropDialog>> = (props) => (
  <AvatarCropDialog {...props} />
);

export const LazyAddEditVendorDialog: React.FC<React.ComponentProps<typeof AddEditVendorDialog>> = (props) => (
  <AddEditVendorDialog {...props} />
);

export const LazyAddEditCustomerDialog: React.FC<React.ComponentProps<typeof AddEditCustomerDialog>> = (props) => (
  <AddEditCustomerDialog {...props} />
);

export const LazyAddEditLocationDialog: React.FC<React.ComponentProps<typeof AddEditLocationDialog>> = (props) => (
  <AddEditLocationDialog {...props} />
);

export const LazyInviteUserDialog: React.FC<React.ComponentProps<typeof InviteUserDialog>> = (props) => (
  <InviteUserDialog {...props} />
);

export const LazyExportDialog: React.FC<React.ComponentProps<typeof ExportDialog>> = (props) => (
  <ExportDialog {...props} />
);

// Component Wrappers (no lazy loading for now)
export const LazyRichTextEditor: React.FC<React.ComponentProps<typeof RichTextEditor>> = (props) => (
  <RichTextEditor {...props} />
);

export const LazyReceiptUpload: React.FC<React.ComponentProps<typeof ReceiptUpload>> = (props) => (
  <ReceiptUpload {...props} />
);

// Export all lazy components as default
export default {
  LazyAddEditExpenseDialog,
  LazyAddEditAutomationDialog,
  LazyCompanySetupDialog,
  LazyAiRedesignTemplateDialog,
  LazySmartAddDialog,
  LazyAvatarCropDialog,
  LazyAddEditVendorDialog,
  LazyAddEditCustomerDialog,
  LazyAddEditLocationDialog,
  LazyInviteUserDialog,
  LazyExportDialog,
  LazyRichTextEditor,
  LazyReceiptUpload,
};