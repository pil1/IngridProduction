import { Router, Response } from 'express';
import { AuthRequest, hasPermission, requireCompany } from '@/middleware/auth';
import { asyncHandler } from '@/middleware/errorHandler';
import { db } from '@/config/database';

const router = Router();

// Get all vendors for current company
router.get('/',
  requireCompany,
  hasPermission('vendors.view'),
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
      FROM vendors
      WHERE company_id = $1
      ORDER BY name ASC
    `, [companyId]);

    res.status(200).json({
      success: true,
      data: {
        vendors: result.rows
      }
    });
  })
);

// Create new vendor
router.post('/',
  requireCompany,
  hasPermission('vendors.create'),
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const {
      name,
      display_name,
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
      payable_account,
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
      spire_vendor_id,
      is_1099_eligible = false,
      is_active = true
    } = req.body;

    if (!name) {
      return res.status(400).json({
        success: false,
        error: { message: 'Vendor name is required' }
      });
    }

    const companyId = req.user?.company_id;

    const result = await db.query(`
      INSERT INTO vendors (
        company_id, name, display_name, contact_person, email, phone,
        address_line_1, address_line_2, city, state_province, postal_code, country,
        website, tax_id, payment_terms, default_currency_code, notes,
        account_number, tax_exempt, credit_limit, payment_method, code,
        payable_account, upload_flag, discount_code, credit_type,
        on_hold, reference_code, apply_finance_charges, default_ship_to_code,
        statement_type, payment_provider_id_int, special_code, spire_status,
        shipping_address_line_1, shipping_address_line_2, shipping_city,
        shipping_state_province, shipping_postal_code, shipping_country,
        spire_vendor_id, is_1099_eligible, is_active, created_by
      )
      VALUES (
        $1, $2, $3, $4, $5, $6,
        $7, $8, $9, $10, $11, $12,
        $13, $14, $15, $16, $17,
        $18, $19, $20, $21, $22,
        $23, $24, $25, $26,
        $27, $28, $29, $30,
        $31, $32, $33, $34,
        $35, $36, $37,
        $38, $39, $40,
        $41, $42, $43, $44
      )
      RETURNING *
    `, [
      companyId, name, display_name, contact_person, email, phone,
      address_line_1, address_line_2, city, state_province, postal_code, country,
      website, tax_id, payment_terms, default_currency_code, notes,
      account_number, tax_exempt, credit_limit, payment_method, code,
      payable_account, upload_flag, discount_code, credit_type,
      on_hold, reference_code, apply_finance_charges, default_ship_to_code,
      statement_type, payment_provider_id_int, special_code, spire_status,
      shipping_address_line_1, shipping_address_line_2, shipping_city,
      shipping_state_province, shipping_postal_code, shipping_country,
      spire_vendor_id, is_1099_eligible, is_active, req.user?.id
    ]);

    res.status(201).json({
      success: true,
      data: {
        vendor: result.rows[0]
      }
    });
  })
);

// Update existing vendor
router.put('/:id',
  requireCompany,
  hasPermission('vendors.edit'),
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const vendorId = req.params.id;
    const companyId = req.user?.company_id;

    // First verify the vendor belongs to the user's company
    const checkResult = await db.query(
      'SELECT id FROM vendors WHERE id = $1 AND company_id = $2',
      [vendorId, companyId]
    );

    if (checkResult.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: { message: 'Vendor not found' }
      });
    }

    const {
      name,
      display_name,
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
      payable_account,
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
      spire_vendor_id,
      is_1099_eligible,
      is_active
    } = req.body;

    const result = await db.query(`
      UPDATE vendors SET
        name = $2, display_name = $3, contact_person = $4, email = $5, phone = $6,
        address_line_1 = $7, address_line_2 = $8, city = $9, state_province = $10, postal_code = $11, country = $12,
        website = $13, tax_id = $14, payment_terms = $15, default_currency_code = $16, notes = $17,
        account_number = $18, tax_exempt = $19, credit_limit = $20, payment_method = $21, code = $22,
        payable_account = $23, upload_flag = $24, discount_code = $25, credit_type = $26,
        on_hold = $27, reference_code = $28, apply_finance_charges = $29, default_ship_to_code = $30,
        statement_type = $31, payment_provider_id_int = $32, special_code = $33, spire_status = $34,
        shipping_address_line_1 = $35, shipping_address_line_2 = $36, shipping_city = $37,
        shipping_state_province = $38, shipping_postal_code = $39, shipping_country = $40,
        spire_vendor_id = $41, is_1099_eligible = $42, is_active = $43, updated_at = NOW()
      WHERE id = $1 AND company_id = $44
      RETURNING *
    `, [
      vendorId, name, display_name, contact_person, email, phone,
      address_line_1, address_line_2, city, state_province, postal_code, country,
      website, tax_id, payment_terms, default_currency_code, notes,
      account_number, tax_exempt, credit_limit, payment_method, code,
      payable_account, upload_flag, discount_code, credit_type,
      on_hold, reference_code, apply_finance_charges, default_ship_to_code,
      statement_type, payment_provider_id_int, special_code, spire_status,
      shipping_address_line_1, shipping_address_line_2, shipping_city,
      shipping_state_province, shipping_postal_code, shipping_country,
      spire_vendor_id, is_1099_eligible, is_active, companyId
    ]);

    res.status(200).json({
      success: true,
      data: {
        vendor: result.rows[0]
      }
    });
  })
);

export default router;