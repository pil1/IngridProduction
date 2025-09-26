import { Router, Response } from 'express';
import { AuthRequest, authorize } from '@/middleware/auth';
import { asyncHandler } from '@/middleware/errorHandler';
import { db } from '@/config/database';

const router = Router();

// Get all currencies with Supabase-style query support
router.get('/',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    // Parse query parameters for Supabase-style filtering
    const { select = '*', order, limit } = req.query as Record<string, string>;
    const isActiveFilter = req.query['is_active[eq]'];

    // Build SELECT clause
    let selectClause = '*';
    if (select === 'id, code, name, symbol') {
      selectClause = 'id, code, name, symbol';
    } else if (select !== '*') {
      selectClause = select;
    }

    // Build WHERE clause
    let whereClause = '';
    const params: any[] = [];
    let paramIndex = 1;

    if (isActiveFilter === 'true') {
      whereClause = 'WHERE is_active = $' + paramIndex;
      params.push(true);
      paramIndex++;
    }

    // Build ORDER clause
    let orderClause = 'ORDER BY code ASC';
    if (order) {
      const [field, direction] = order.split('.');
      orderClause = `ORDER BY ${field} ${direction?.toUpperCase() === 'DESC' ? 'DESC' : 'ASC'}`;
    }

    // Build LIMIT clause
    let limitClause = '';
    if (limit) {
      limitClause = `LIMIT $${paramIndex}`;
      params.push(parseInt(limit));
    }

    const query = `
      SELECT ${selectClause}
      FROM currencies
      ${whereClause}
      ${orderClause}
      ${limitClause}
    `;

    const result = await db.query(query, params);

    // Return data directly for Supabase compatibility (without wrapping in success/data)
    res.status(200).json(result.rows);
  })
);

export default router;