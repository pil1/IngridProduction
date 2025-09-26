# User Management API Documentation

**Version**: 2.0
**Last Updated**: September 2025

## Overview

The User Management API provides comprehensive endpoints for managing users, permissions, and modules within the INFOtrac system. All endpoints support JSON request/response format and require proper authentication.

## Base URL
```
http://localhost:3001/api (Development)
https://api.infotrac.com/api (Production)
```

## Authentication

All API endpoints (except health checks) require a Bearer token in the Authorization header:

```http
Authorization: Bearer YOUR_JWT_TOKEN
```

## Error Response Format

All errors follow a consistent format:

```json
{
  "success": false,
  "error": "Human-readable error message",
  "code": "ERROR_CODE",
  "details": {
    "field": "specific field error"
  }
}
```

## Success Response Format

All successful responses follow this format:

```json
{
  "success": true,
  "data": {
    // Response data here
  },
  "message": "Optional success message"
}
```

---

## 🔐 Permissions API

### Get Permission Hierarchy

Get all permissions with plain English descriptions and hierarchical relationships.

**Endpoint**: `GET /api/permissions/hierarchy`

**Query Parameters**:
- `role` (optional): Filter permissions for specific role

**Response**:
```json
{
  "success": true,
  "data": {
    "permissions": [
      {
        "id": "uuid",
        "permission_key": "users.view",
        "permission_name": "View Users",
        "human_description": "View user accounts and profiles",
        "permission_group": "User Management",
        "ui_display_order": 1,
        "requires_permissions": [],
        "category": "core",
        "module_id": "user-management",
        "is_system_permission": true
      }
    ],
    "grouped": {
      "User Management": [
        // Permissions grouped by category
      ]
    }
  }
}
```

### Get User Permissions

Get effective permissions for a specific user.

**Endpoint**: `GET /api/permissions/user/:userId`

**Parameters**:
- `userId`: User UUID

**Response**:
```json
{
  "success": true,
  "data": {
    "user_role": "admin",
    "role_permissions": [
      {
        "permission_key": "users.view",
        "permission_name": "View Users",
        "human_description": "View user accounts and profiles",
        "is_granted": true,
        "source": "role"
      }
    ],
    "user_permissions": [
      {
        "permission_key": "expenses.approve",
        "permission_name": "Approve Expenses",
        "human_description": "Approve expense reports for payment",
        "is_granted": true,
        "granted_by": "admin-uuid",
        "granted_at": "2025-01-15T10:30:00Z"
      }
    ]
  }
}
```

### Grant/Revoke Permission

Grant or revoke a specific permission for a user.

**Endpoint**: `POST /api/permissions/user/:userId/grant`

**Authorization**: `admin` or `super-admin`

**Request Body**:
```json
{
  "permission_key": "expenses.approve",
  "is_granted": true,
  "expires_at": "2025-12-31T23:59:59Z"
}
```

**Response**:
```json
{
  "success": true,
  "message": "Permission granted successfully"
}
```

### Validate Permission Dependencies

Validate that a set of permissions meets all dependency requirements.

**Endpoint**: `POST /api/permissions/validate`

**Request Body**:
```json
{
  "user_id": "user-uuid",
  "permissions": [
    "users.view",
    "users.edit",
    "expenses.approve"
  ]
}
```

**Response**:
```json
{
  "success": true,
  "data": [
    {
      "permission_key": "expenses.approve",
      "is_valid": false,
      "error_message": "Requires 'expenses.view' permission",
      "missing_dependencies": ["expenses.view"]
    }
  ]
}
```

---

## 👥 Users API

### Get All Users

Retrieve all users with their permissions and module access.

**Endpoint**: `GET /api/users`

**Query Parameters**:
- `company_id` (optional): Filter by company
- `role` (optional): Filter by role
- `active` (optional): Filter by active status

**Response**:
```json
{
  "success": true,
  "data": {
    "users": [
      {
        "id": "user-uuid",
        "email": "user@example.com",
        "fullName": "John Doe",
        "firstName": "John",
        "lastName": "Doe",
        "role": "admin",
        "companyId": "company-uuid",
        "companyName": "Acme Corp",
        "isActive": true,
        "lastSignIn": "2025-01-15T09:30:00Z",
        "createdAt": "2025-01-01T00:00:00Z"
      }
    ],
    "total": 50,
    "page": 1,
    "limit": 25
  }
}
```

---

## 🏢 Companies API

### Get All Companies

Retrieve companies with optional filtering.

**Endpoint**: `GET /api/companies`

**Query Parameters**:
- `select`: Specify fields to return
- `is_active[eq]`: Filter by active status
- `order`: Sort order (field.direction)
- `limit`: Limit number of results

**Response**:
```json
{
  "success": true,
  "data": [
    {
      "id": "company-uuid",
      "name": "Acme Corporation",
      "slug": "acme-corp",
      "website": "https://acme.com",
      "industry": "Technology",
      "subscription_plan": "pro",
      "billing_cycle": "monthly",
      "is_active": true,
      "created_at": "2025-01-01T00:00:00Z"
    }
  ]
}
```

### Get Current Company

Get the company associated with the current user.

**Endpoint**: `GET /api/companies/current`

**Response**:
```json
{
  "success": true,
  "data": {
    "company": {
      "id": "company-uuid",
      "name": "Acme Corporation",
      "slug": "acme-corp",
      "subscription_plan": "pro",
      "billing_cycle": "monthly"
    }
  }
}
```

### Create Company

Create a new company (Super Admin only).

**Endpoint**: `POST /api/companies`

**Authorization**: `super-admin`

**Request Body**:
```json
{
  "name": "New Company",
  "domain": "newcompany.com",
  "default_currency": "USD"
}
```

**Response**:
```json
{
  "id": "new-company-uuid",
  "name": "New Company",
  "slug": "new-company",
  "website": "newcompany.com",
  "is_active": true,
  "created_at": "2025-01-15T10:30:00Z"
}
```

### Provision Company (Comprehensive)

Create a fully configured company with admin user and modules.

**Endpoint**: `POST /api/companies/provision`

**Authorization**: `super-admin`

**Request Body**:
```json
{
  "name": "Acme Corporation",
  "slug": "acme-corp",
  "description": "Leading technology company",
  "industry": "Technology",
  "website": "https://acme.com",
  "address_line1": "123 Main St",
  "city": "San Francisco",
  "state": "CA",
  "postal_code": "94105",
  "country": "USA",
  "phone": "+1-555-0123",
  "subscription_plan": "pro",
  "billing_cycle": "monthly",
  "base_currency": "USD",
  "enabled_modules": ["expenses", "analytics", "automation"],
  "auto_create_admin": true,
  "admin_user": {
    "email": "admin@acme.com",
    "full_name": "John Admin",
    "phone": "+1-555-0124",
    "password": "optional-initial-password"
  }
}
```

**Response**:
```json
{
  "success": true,
  "message": "Company provisioned successfully",
  "data": {
    "company": {
      "id": "company-uuid",
      "name": "Acme Corporation",
      "slug": "acme-corp",
      // ... full company details
    },
    "admin_user": {
      "id": "admin-user-uuid",
      "email": "admin@acme.com",
      "full_name": "John Admin",
      "role": "admin",
      "invitation_sent": false,
      "password_set": true
    },
    "enabled_modules": ["core-module-1", "expenses", "analytics"],
    "module_count": 3
  }
}
```

---

## 🧩 Modules API

### Get All Modules

Retrieve all system modules with classification and pricing.

**Endpoint**: `GET /api/modules`

**Response**:
```json
{
  "success": true,
  "data": {
    "modules": [
      {
        "id": "expenses-module",
        "name": "Expense Management",
        "description": "Track and approve company expenses",
        "module_type": "core",
        "module_classification": "core",
        "is_core_required": true,
        "default_monthly_price": 29.99,
        "default_per_user_price": 5.99,
        "is_active": true,
        "created_at": "2025-01-01T00:00:00Z"
      }
    ]
  }
}
```

### Get User Modules

Get modules accessible to a specific user.

**Endpoint**: `GET /api/modules/user/:userId`

**Parameters**:
- `userId`: User UUID

**Response**:
```json
{
  "success": true,
  "data": {
    "modules": [
      {
        "id": "expenses-module",
        "name": "Expense Management",
        "is_enabled": true,
        "company_enabled": true,
        "has_access": true,
        "granted_by": "admin-uuid",
        "granted_at": "2025-01-10T15:30:00Z"
      }
    ]
  }
}
```

### Enable/Disable User Module

Enable or disable a module for a specific user.

**Endpoint**: `POST /api/modules/user/:userId/enable/:moduleId`
**Endpoint**: `POST /api/modules/user/:userId/disable/:moduleId`

**Authorization**: `admin` or `super-admin`

**Response**:
```json
{
  "success": true,
  "message": "Module enabled successfully"
}
```

### Update Module Classification

Update module classification (Super Admin only).

**Endpoint**: `PATCH /api/modules/:moduleId/classification`

**Authorization**: `super-admin`

**Request Body**:
```json
{
  "module_classification": "addon",
  "default_monthly_price": 49.99,
  "default_per_user_price": 9.99
}
```

**Response**:
```json
{
  "success": true,
  "message": "Module classification updated successfully",
  "data": {
    "module": {
      "id": "module-uuid",
      "module_classification": "addon",
      "classification_changed_at": "2025-01-15T10:30:00Z",
      "classification_changed_by": "super-admin-uuid"
    }
  }
}
```

### Get Module Management Overview

Get comprehensive module management data (Super Admin only).

**Endpoint**: `GET /api/modules/management`

**Authorization**: `super-admin`

**Response**:
```json
{
  "success": true,
  "data": {
    "modules": [
      {
        "id": "expenses-module",
        "name": "Expense Management",
        "module_classification": "core",
        "companies_using": 45,
        "users_with_access": 234,
        "monthly_revenue": 1347.55,
        "classification_history": [
          {
            "changed_at": "2025-01-01T00:00:00Z",
            "changed_by": "super-admin-uuid",
            "old_classification": "addon",
            "new_classification": "core"
          }
        ]
      }
    ],
    "summary": {
      "total_modules": 12,
      "core_modules": 5,
      "addon_modules": 7,
      "total_monthly_revenue": 15432.10
    }
  }
}
```

---

## 🔧 RPC Functions API

### Check User Permission

Check if a user has a specific permission.

**Endpoint**: `POST /api/rpc/user_has_permission`

**Request Body**:
```json
{
  "user_id_param": "user-uuid",
  "permission_key_param": "expenses.approve",
  "company_id_param": "company-uuid"
}
```

**Response**:
```json
{
  "success": true,
  "data": {
    "has_permission": true,
    "source": "role",
    "granted_at": "2025-01-10T15:30:00Z"
  }
}
```

---

## 📋 Health Check

### System Health

Check system health and database connectivity.

**Endpoint**: `GET /health`

**Response**:
```json
{
  "status": "healthy",
  "timestamp": "2025-01-15T10:30:00Z",
  "services": {
    "database": "connected",
    "redis": "connected",
    "api": "operational"
  },
  "version": "2.0.0"
}
```

---

## 🚨 Error Codes

| Code | Description |
|------|-------------|
| `AUTH_REQUIRED` | Authentication token required |
| `AUTH_INVALID` | Invalid or expired token |
| `PERMISSION_DENIED` | Insufficient permissions |
| `USER_NOT_FOUND` | User does not exist |
| `COMPANY_NOT_FOUND` | Company does not exist |
| `MODULE_NOT_FOUND` | Module does not exist |
| `PERMISSION_NOT_FOUND` | Permission does not exist |
| `VALIDATION_ERROR` | Request validation failed |
| `DEPENDENCY_ERROR` | Permission dependency not met |
| `DATABASE_ERROR` | Database operation failed |
| `RATE_LIMITED` | Too many requests |

---

## 📊 Rate Limiting

All API endpoints are subject to rate limiting:

- **Default**: 100 requests per minute per IP
- **Authentication**: 10 login attempts per minute per IP
- **Heavy Operations**: 20 requests per minute for bulk operations

Rate limit headers are included in all responses:
```http
X-RateLimit-Limit: 100
X-RateLimit-Remaining: 99
X-RateLimit-Reset: 1642176000
```

---

## 🔍 Filtering & Pagination

### Query Parameters

Most list endpoints support these parameters:

- `page`: Page number (default: 1)
- `limit`: Items per page (default: 25, max: 100)
- `sort`: Sort field
- `order`: Sort direction (asc/desc)
- `search`: Search term
- `filter[field]`: Filter by field value

### Example
```http
GET /api/users?page=2&limit=50&sort=created_at&order=desc&search=john&filter[role]=admin
```

---

## 📝 Usage Examples

### JavaScript/TypeScript

```typescript
// Get permissions with plain English descriptions
const getPermissions = async () => {
  const response = await fetch('/api/permissions/hierarchy', {
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    }
  });

  const data = await response.json();
  return data.data.grouped; // Permissions grouped by category
};

// Grant permission with dependency validation
const grantPermission = async (userId: string, permissionKey: string) => {
  try {
    const response = await fetch(`/api/permissions/user/${userId}/grant`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        permission_key: permissionKey,
        is_granted: true
      })
    });

    const result = await response.json();
    if (!result.success) {
      throw new Error(result.error);
    }

    return result;
  } catch (error) {
    console.error('Failed to grant permission:', error);
    throw error;
  }
};

// Provision new company
const provisionCompany = async (companyData: any) => {
  const response = await fetch('/api/companies/provision', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(companyData)
  });

  return response.json();
};
```

### cURL Examples

```bash
# Get permission hierarchy
curl -X GET \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  http://localhost:3001/api/permissions/hierarchy

# Grant permission
curl -X POST \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"permission_key": "expenses.approve", "is_granted": true}' \
  http://localhost:3001/api/permissions/user/USER_UUID/grant

# Create company
curl -X POST \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"name": "New Company", "default_currency": "USD"}' \
  http://localhost:3001/api/companies
```

---

## 🛠️ Development & Testing

### Local Development

1. Start the backend server:
```bash
cd backend && npm run dev
```

2. API will be available at `http://localhost:3001/api`

3. Health check: `curl http://localhost:3001/health`

### Testing

Use the included Postman collection or create test requests:

```javascript
// Test authentication
const testAuth = async () => {
  const response = await fetch('/api/permissions/hierarchy');
  console.log(response.status); // Should be 401 without token
};

// Test with valid token
const testWithAuth = async () => {
  const response = await fetch('/api/permissions/hierarchy', {
    headers: { 'Authorization': `Bearer ${validToken}` }
  });
  console.log(await response.json()); // Should return permissions
};
```

---

This API documentation covers all the enhanced User Management endpoints. For additional support or questions, refer to the main documentation or contact the development team.