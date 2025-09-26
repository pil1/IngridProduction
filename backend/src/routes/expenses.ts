import { Router, Response } from 'express';
import { AuthRequest, hasPermission, requireCompany } from '@/middleware/auth';
import { asyncHandler } from '@/middleware/errorHandler';
import { db } from '@/config/database';

const router = Router();

// Get all expenses for current company
router.get('/',
  requireCompany,
  hasPermission('expenses.view'),
  asyncHandler(async (req: AuthRequest, res: Response) => {
    let companyId = req.user?.company_id;

    // Allow super-admins to specify company via query param
    if (req.user?.role === 'super-admin' && req.query.company_id) {
      companyId = req.query.company_id as string;
    }

    const result = await db.query(`
      SELECT
        e.id,
        e.title,
        e.description,
        e.amount,
        e.currency_code,
        e.expense_date,
        e.status,
        e.vendor_name,
        e.submitted_at,
        e.created_at,
        p.first_name as submitter_first_name,
        p.last_name as submitter_last_name,
        ec.name as category_name,
        v.name as vendor_display_name
      FROM expenses e
      LEFT JOIN profiles p ON e.submitted_by = p.user_id
      LEFT JOIN expense_categories ec ON e.category_id = ec.id
      LEFT JOIN vendors v ON e.vendor_id = v.id
      WHERE e.company_id = $1
      ORDER BY e.created_at DESC
      LIMIT 100
    `, [companyId]);

    res.status(200).json({
      success: true,
      data: {
        expenses: result.rows.map(expense => ({
          id: expense.id,
          title: expense.title,
          description: expense.description,
          amount: parseFloat(expense.amount),
          currencyCode: expense.currency_code,
          expenseDate: expense.expense_date,
          status: expense.status,
          vendorName: expense.vendor_display_name || expense.vendor_name,
          categoryName: expense.category_name,
          submitterName: `${expense.submitter_first_name} ${expense.submitter_last_name}`.trim(),
          submittedAt: expense.submitted_at,
          createdAt: expense.created_at,
        }))
      }
    });
  })
);

export default router;