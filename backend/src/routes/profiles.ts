import { Router, Response } from 'express';
import { AuthRequest, authorize, hasPermission } from '@/middleware/auth';
import { asyncHandler } from '@/middleware/errorHandler';
import { db } from '@/config/database';

const router = Router();

// Get profiles with Supabase-style query support
router.get('/',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    // Parse query parameters for Supabase-style filtering
    const { select = '*', order, limit } = req.query as Record<string, string>;
    const userIdFilter = req.query['user_id[eq]'];
    const companyIdFilter = req.query['company_id[eq]'];

    // Build SELECT clause
    let selectClause = 'p.*';
    if (select.includes('user_id') || select.includes('email') || select.includes('full_name')) {
      // Parse the select fields and handle the multiline format
      const cleanSelect = select.replace(/\s+/g, ' ').trim();
      const fields = cleanSelect.split(',').map(field => field.trim());
      selectClause = fields.map(field => `p.${field}`).join(', ');
    } else if (select !== '*') {
      // For other specific selects, use as-is but prefix with p.
      selectClause = select.split(',').map(field => `p.${field.trim()}`).join(', ');
    }

    // Build WHERE clause
    let whereClause = '';
    const params: any[] = [];
    let paramIndex = 1;
    const conditions: string[] = [];

    if (userIdFilter) {
      conditions.push(`p.user_id = $${paramIndex}`);
      params.push(userIdFilter);
      paramIndex++;
    }

    if (companyIdFilter) {
      conditions.push(`p.company_id = $${paramIndex}`);
      params.push(companyIdFilter);
      paramIndex++;
    }

    if (conditions.length > 0) {
      whereClause = 'WHERE ' + conditions.join(' AND ');
    }

    // Build ORDER clause
    let orderClause = 'ORDER BY p.created_at DESC';
    if (order) {
      const [field, direction] = order.split('.');
      orderClause = `ORDER BY p.${field} ${direction?.toUpperCase() === 'DESC' ? 'DESC' : 'ASC'}`;
    }

    // Build LIMIT clause
    let limitClause = '';
    if (limit) {
      limitClause = `LIMIT $${paramIndex}`;
      params.push(parseInt(limit));
    }

    const query = `
      SELECT ${selectClause}
      FROM profiles p
      ${whereClause}
      ${orderClause}
      ${limitClause}
    `;

    const result = await db.query(query, params);

    // Return data directly for Supabase compatibility
    res.status(200).json({
      success: true,
      data: result.rows
    });
  })
);

// Get single profile
router.get('/:id',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const { id } = req.params;

    const result = await db.query(`
      SELECT * FROM profiles WHERE user_id = $1
    `, [id]);

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: { message: 'Profile not found' }
      });
    }

    res.status(200).json({
      success: true,
      data: result.rows[0]
    });
  })
);

export default router;