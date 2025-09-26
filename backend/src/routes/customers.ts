import { Router, Response } from 'express';
import { AuthRequest, hasPermission, requireCompany } from '@/middleware/auth';
import { asyncHandler } from '@/middleware/errorHandler';
import { db } from '@/config/database';

const router = Router();

// Get all customers for current company
router.get('/',
  requireCompany,
  hasPermission('customers.view'),
  asyncHandler(async (req: AuthRequest, res: Response) => {
    let companyId = req.user?.company_id;

    // Allow super-admins to specify company via query param
    if (req.user?.role === 'super-admin' && req.query.company_id) {
      companyId = req.query.company_id as string;
    }

    const result = await db.query(`
      SELECT
        id,
        name,
        display_name,
        email,
        phone,
        website,
        address_line_1,
        city,
        state_province,
        country,
        is_active,
        created_at,
        updated_at
      FROM customers
      WHERE company_id = $1
      ORDER BY name ASC
    `, [companyId]);

    res.status(200).json({
      success: true,
      data: {
        customers: result.rows
      }
    });
  })
);

// Create new customer
router.post('/',
  requireCompany,
  hasPermission('customers.create'),
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const {
      name,
      contact_person,
      email,
      phone,
      address_line_1,
      address_line_2,
      city,
      state_province,
      postal_code,
      country,
      website,
      tax_id,
      payment_terms,
      default_currency_code = 'USD',
      notes,
      account_number,
      tax_exempt = false,
      credit_limit,
      payment_method,
      code,
      receivable_account,
      upload_flag = true,
      discount_code,
      credit_type,
      on_hold = false,
      reference_code,
      apply_finance_charges = false,
      default_ship_to_code,
      statement_type,
      payment_provider_id_int,
      special_code,
      spire_status,
      shipping_address_line_1,
      shipping_address_line_2,
      shipping_city,
      shipping_state_province,
      shipping_postal_code,
      shipping_country,
      spire_customer_id,
      is_active = true
    } = req.body;

    if (!name) {
      return res.status(400).json({
        success: false,
        error: { message: 'Customer name is required' }
      });
    }

    const companyId = req.user?.company_id;

    const result = await db.query(`
      INSERT INTO customers (
        company_id, name, contact_person, email, phone,
        address_line_1, address_line_2, city, state_province, postal_code, country,
        website, tax_id, payment_terms, default_currency_code, notes,
        account_number, tax_exempt, credit_limit, payment_method, code,
        receivable_account, upload_flag, discount_code, credit_type,
        on_hold, reference_code, apply_finance_charges, default_ship_to_code,
        statement_type, payment_provider_id_int, special_code, spire_status,
        shipping_address_line_1, shipping_address_line_2, shipping_city,
        shipping_state_province, shipping_postal_code, shipping_country,
        spire_customer_id, is_active, created_by
      )
      VALUES (
        $1, $2, $3, $4, $5,
        $6, $7, $8, $9, $10, $11,
        $12, $13, $14, $15, $16,
        $17, $18, $19, $20, $21,
        $22, $23, $24, $25,
        $26, $27, $28, $29,
        $30, $31, $32, $33,
        $34, $35, $36,
        $37, $38, $39,
        $40, $41, $42
      )
      RETURNING *
    `, [
      companyId, name, contact_person, email, phone,
      address_line_1, address_line_2, city, state_province, postal_code, country,
      website, tax_id, payment_terms, default_currency_code, notes,
      account_number, tax_exempt, credit_limit, payment_method, code,
      receivable_account, upload_flag, discount_code, credit_type,
      on_hold, reference_code, apply_finance_charges, default_ship_to_code,
      statement_type, payment_provider_id_int, special_code, spire_status,
      shipping_address_line_1, shipping_address_line_2, shipping_city,
      shipping_state_province, shipping_postal_code, shipping_country,
      spire_customer_id, is_active, req.user?.id
    ]);

    res.status(201).json({
      success: true,
      data: {
        customer: result.rows[0]
      }
    });
  })
);

// Update existing customer
router.put('/:id',
  requireCompany,
  hasPermission('customers.edit'),
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const customerId = req.params.id;
    const companyId = req.user?.company_id;

    // First verify the customer belongs to the user's company
    const checkResult = await db.query(
      'SELECT id FROM customers WHERE id = $1 AND company_id = $2',
      [customerId, companyId]
    );

    if (checkResult.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: { message: 'Customer not found' }
      });
    }

    const {
      name,
      contact_person,
      email,
      phone,
      address_line_1,
      address_line_2,
      city,
      state_province,
      postal_code,
      country,
      website,
      tax_id,
      payment_terms,
      default_currency_code,
      notes,
      account_number,
      tax_exempt,
      credit_limit,
      payment_method,
      code,
      receivable_account,
      upload_flag,
      discount_code,
      credit_type,
      on_hold,
      reference_code,
      apply_finance_charges,
      default_ship_to_code,
      statement_type,
      payment_provider_id_int,
      special_code,
      spire_status,
      shipping_address_line_1,
      shipping_address_line_2,
      shipping_city,
      shipping_state_province,
      shipping_postal_code,
      shipping_country,
      spire_customer_id,
      is_active
    } = req.body;

    const result = await db.query(`
      UPDATE customers SET
        name = $2, contact_person = $3, email = $4, phone = $5,
        address_line_1 = $6, address_line_2 = $7, city = $8, state_province = $9, postal_code = $10, country = $11,
        website = $12, tax_id = $13, payment_terms = $14, default_currency_code = $15, notes = $16,
        account_number = $17, tax_exempt = $18, credit_limit = $19, payment_method = $20, code = $21,
        receivable_account = $22, upload_flag = $23, discount_code = $24, credit_type = $25,
        on_hold = $26, reference_code = $27, apply_finance_charges = $28, default_ship_to_code = $29,
        statement_type = $30, payment_provider_id_int = $31, special_code = $32, spire_status = $33,
        shipping_address_line_1 = $34, shipping_address_line_2 = $35, shipping_city = $36,
        shipping_state_province = $37, shipping_postal_code = $38, shipping_country = $39,
        spire_customer_id = $40, is_active = $41, updated_at = NOW()
      WHERE id = $1 AND company_id = $42
      RETURNING *
    `, [
      customerId, name, contact_person, email, phone,
      address_line_1, address_line_2, city, state_province, postal_code, country,
      website, tax_id, payment_terms, default_currency_code, notes,
      account_number, tax_exempt, credit_limit, payment_method, code,
      receivable_account, upload_flag, discount_code, credit_type,
      on_hold, reference_code, apply_finance_charges, default_ship_to_code,
      statement_type, payment_provider_id_int, special_code, spire_status,
      shipping_address_line_1, shipping_address_line_2, shipping_city,
      shipping_state_province, shipping_postal_code, shipping_country,
      spire_customer_id, is_active, companyId
    ]);

    res.status(200).json({
      success: true,
      data: {
        customer: result.rows[0]
      }
    });
  })
);

export default router;