"use client";

export const ACTION_TYPES = [
  { value: 'send_email', label: 'Send an Email' },
  { value: 'generate_report', label: 'Generate a Report' }, // New action type
  // Future actions can be added here, e.g., 'send_slack_message'
];

export const RECIPIENT_TYPES = [
  { value: 'user', label: 'The user who triggered the event' },
  { value: 'admin', label: 'All company admins' },
  { value: 'submitter', label: 'The original submitter of the expense' },
  { value: 'specific_email', label: 'A specific email address' }, // For reports
];

export const TRIGGER_TYPES = [ // New export for trigger types
  { value: 'expense.submitted', label: 'Expense Submitted' },
  { value: 'expense.approved', label: 'Expense Approved' },
  { value: 'expense.rejected', label: 'Expense Rejected' },
  { value: 'expense.commented', label: 'Expense Commented' },
  { value: 'schedule.daily', label: 'Daily Schedule' }, // New scheduled trigger type
  { value: 'schedule.weekly', label: 'Weekly Schedule' }, // New scheduled trigger type
  { value: 'schedule.monthly', label: 'Monthly Schedule' }, // New scheduled trigger type
  // Future triggers can be added here
];

export interface Suggestion {
  name: string;
  trigger_type: string;
  description: string;
}