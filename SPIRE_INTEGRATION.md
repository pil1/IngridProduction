# Spire Data Tables & INFOtrac Field Mappings

## 1. Introduction

This document serves as the primary internal reference for developers, outlining the data synchronization and field mappings between the INFOtrac application and the Spire Systems ERP.

**Golden Rule:** No data-centric feature in INFOtrac should be developed without referencing this document to ensure it correctly aligns with the corresponding Spire data structures. All new or modified fields that require synchronization must be added here.

This ensures a unified data ecosystem, automated financial workflows, and a single source of truth across both platforms, as detailed in the `REWRITE_SPECIFICATION.md`.

## 2. Core Spire API Endpoints

INFOtrac primarily interacts with the following Spire API endpoints.

- **Customers**: `/api/v2/companies/{company}/ar/customers/`
- **Vendors**: `/api/v2/companies/{company}/ap/vendors/`
- **Sales**: `/api/v2/companies/{company}/oe/sales/` (For sales orders, invoices)
- **Purchase Orders**: `/api/v2/companies/{company}/po/purchaseorders/` (For expenses, payables)
- **GL Accounts**: `/api/v2/companies/{company}/gl/accounts/`

## 3. Field Mapping Architecture

### 3.1 Customer Mapping

- **INFOtrac Entity**: `customers`
- **Spire Endpoint**: `/api/v2/companies/{company}/ar/customers/`

This mapping is crucial for managing customer information and ensuring that sales and invoicing data from INFOtrac are correctly attributed in Spire.

| INFOtrac Field (`customers`) | Spire Field (`ar/customers`) | Data Type | Sync Direction | Notes |
| :--- | :--- | :--- | :--- | :--- |
| `id` | `customerNo` | String | INFOtrac -> Spire | Primary key mapping. `customerNo` is Spire's unique ID. |
| `name` | `name` | String | Bidirectional | Customer's company name. |
| `code` / `account_number` | `code` | String | Bidirectional | A unique code for the customer, often an account number. |
| `contact_person` | `contact` | String | Bidirectional | Primary contact person's name. |
| `email` | `email` | String | Bidirectional | Primary contact email. |
| `phone` | `phone` | String | Bidirectional | Primary phone number. |
| `website` | `userDef1` (or other UDF) | String | Bidirectional | Spire lacks a dedicated website field; map to a User-Defined Field. |
| `address_line_1` | `address.address1` | String | Bidirectional | |
| `address_line_2` | `address.address2` | String | Bidirectional | |
| `city` | `address.city` | String | Bidirectional | |
| `state_province` | `address.provState` | String | Bidirectional | |
| `postal_code` | `address.postalCode` | String | Bidirectional | |
| `country` | `address.country` | String | Bidirectional | |
| `shipping_address_line_1` | `shipTo.address1` | String | Bidirectional | Default shipping address. |
| `shipping_city` | `shipTo.city` | String | Bidirectional | |
| `shipping_state_province` | `shipTo.provState` | String | Bidirectional | |
| `shipping_postal_code` | `shipTo.postalCode` | String | Bidirectional | |
| `shipping_country` | `shipTo.country` | String | Bidirectional | |
| `tax_id` | `taxCode` | String | Bidirectional | Maps to Spire's tax jurisdiction/code system. |
| `payment_terms` | `termsCode` | String | Bidirectional | e.g., "Net 30". Must match a valid code in Spire. |
| `default_currency_code` | `currency` | String | Bidirectional | 3-letter ISO code (e.g., 'CAD', 'USD'). |
| `credit_limit` | `creditLimit` | Number | Bidirectional | |
| `on_hold` | `onHold` | Boolean | Bidirectional | |
| `is_active` | `status` | Integer | Bidirectional | `status: 0` (Active) in Spire maps to `is_active: true`. `1` (Inactive) maps to `false`. |
| `receivable_account` | `receivableAcct` | String | Bidirectional | GL Account for receivables. |
| `notes` | `notes` | String | Bidirectional | General notes field. |
| `user_def_1` | `userDef1` | String | Bidirectional | User-defined field 1. |
| `user_def_2` | `userDef2` | String | Bidirectional | User-defined field 2. |

---

### 3.2 Vendor Mapping

- **INFOtrac Entity**: `vendors`
- **Spire Endpoint**: `/api/v2/companies/{company}/ap/vendors/`

This mapping is essential for synchronizing vendor information, which is foundational for processing expenses and payables.

| INFOtrac Field (`vendors`) | Spire Field (`ap/vendors`) | Data Type | Sync Direction | Notes |
| :--- | :--- | :--- | :--- | :--- |
| `id` | `vendorNo` | String | INFOtrac -> Spire | Primary key mapping. `vendorNo` is Spire's unique ID. |
| `name` | `name` | String | Bidirectional | Vendor's company name. |
| `account_number` | `code` | String | Bidirectional | A unique code for the vendor. |
| `contact_person` | `contact` | String | Bidirectional | Primary contact person's name. |
| `email` | `email` | String | Bidirectional | Primary contact email. |
| `phone` | `phone` | String | Bidirectional | Primary phone number. |
| `website` | `userDef1` (or other UDF) | String | Bidirectional | Map to a User-Defined Field. |
| `address_line_1` | `address.address1` | String | Bidirectional | |
| `address_line_2` | `address.address2` | String | Bidirectional | |
| `city` | `address.city` | String | Bidirectional | |
| `state_province` | `address.provState` | String | Bidirectional | |
| `postal_code` | `address.postalCode` | String | Bidirectional | |
| `country` | `address.country` | String | Bidirectional | |
| `tax_id` | `taxCode` | String | Bidirectional | Maps to Spire's tax jurisdiction/code system. |
| `payment_terms` | `termsCode` | String | Bidirectional | Must match a valid code in Spire. |
| `default_currency_code` | `currency` | String | Bidirectional | 3-letter ISO code. |
| `credit_limit` | `creditLimit` | Number | Bidirectional | |
| `is_active` | `status` | Integer | Bidirectional | `status: 0` (Active) maps to `is_active: true`. |
| `payable_account` | `payableAcct` | String | Bidirectional | GL Account for payables. |
| `notes` | `notes` | String | Bidirectional | General notes field. |

---

### 3.3 Expense & Purchase Order Mapping

- **INFOtrac Entity**: `expenses`
- **Spire Endpoint**: `/api/v2/companies/{company}/po/purchaseorders/`

Expenses from INFOtrac will be synchronized as Purchase Orders in Spire to represent a payable transaction.

#### Header Level

| INFOtrac Field (`expenses`) | Spire Field (`po/purchaseorders`) | Data Type | Sync Direction | Notes |
| :--- | :--- | :--- | :--- | :--- |
| `id` | `orderNo` | String | INFOtrac -> Spire | The INFOtrac expense ID maps to the Spire PO number. |
| `company_id` | (Context) | String | INFOtrac -> Spire | Used in the API path. |
| `vendor_id` | `vendorNo` | String | INFOtrac -> Spire | Links the PO to the correct vendor in Spire. |
| `title` / `description` | `description` | String | INFOtrac -> Spire | A summary of the expense. |
| `expense_date` | `orderDate` | Date | INFOtrac -> Spire | |
| `submitted_by` | `reqBy` | String | INFOtrac -> Spire | Maps INFOtrac user to the 'Requested By' field. |
| `status` | `status` | Integer | Bidirectional | `0`=Open, `1`=Closed. Mapping logic required. |
| `total_amount` | `total` | Number | Bidirectional | The total value of the expense/PO. |
| `currency_code` | `currency` | String | INFOtrac -> Spire | |
| `project_code` | `jobNo` | String | INFOtrac -> Spire | If using Spire's job costing module. |

#### Line Item Level

- **INFOtrac Entity**: `expense_line_items`
- **Spire Endpoint**: `po/purchaseorders/{id}/items/`

| INFOtrac Field (`expense_line_items`) | Spire Field (`items`) | Data Type | Sync Direction | Notes |
| :--- | :--- | :--- | :--- | :--- |
| `description` | `description` | String | INFOtrac -> Spire | Description for the specific line item. |
| `quantity` | `orderQty` | Number | INFOtrac -> Spire | |
| `unit_price` | `cost` | Number | INFOtrac -> Spire | The cost per unit. |
| `total_amount` | `extended` | Number | INFOtrac -> Spire | The total for the line (`quantity` * `unit_price`). |
| `gl_account_id` | `glAccount` | String | INFOtrac -> Spire | The General Ledger account to debit for this line item. |
| `category_id` | `partNo` | String | INFOtrac -> Spire | Can map to a non-stock part number for categorization. |

---

### 3.4 User & Employee Mapping

- **INFOtrac Entity**: `profiles`
- **Spire Endpoint**: `/api/v2/companies/{company}/gl/salespersons/` (or other employee-related table)

This mapping connects INFOtrac users to Spire entities for tracking approvals and requests. `salespersons` is often used for this purpose.

| INFOtrac Field (`profiles`) | Spire Field (`gl/salespersons`) | Data Type | Sync Direction | Notes |
| :--- | :--- | :--- | :--- | :--- |
| `user_id` | `code` | String | INFOtrac -> Spire | A unique code to identify the user/employee. |
| `first_name` | `firstName` | String | Bidirectional | |
| `last_name` | `lastName` | String | Bidirectional | |
| `email` | `email` | String | Bidirectional | |
| `phone` | `phone` | String | Bidirectional | |
| `is_active` | `inactive` | Boolean | Bidirectional | Inverse mapping: `is_active: true` maps to `inactive: false`. |

## 4. Synchronization Strategy

### 4.1 Real-time vs. Batch
- **Real-time Sync**: Used for critical state changes, such as creating a new customer/vendor or submitting a final-approved expense. This is triggered by specific business events in INFOtrac.
- **Batch Sync**: A scheduled job runs periodically (e.g., every 15 minutes) to sync updates for non-critical fields (e.g., updating a contact person's name) and to perform data reconciliation.

### 4.2 Conflict Resolution
- **Timestamp-based**: The record with the most recent `updated_at` timestamp wins.
- **Manual Override**: For critical conflicts, a notification is sent to a Company Administrator to resolve the discrepancy manually in a dedicated UI.
- **Source of Truth**: For new records, INFOtrac is the source of truth. For financial master data (like GL Accounts), Spire is the source of truth.

### 4.3 Error Handling
- All synchronization attempts are logged with their status (success, failure, pending).
- Transient API errors will trigger an automatic retry mechanism with exponential backoff.
- Persistent errors (e.g., validation failures) will halt the sync for that specific record and create a notification for an administrator to investigate.
