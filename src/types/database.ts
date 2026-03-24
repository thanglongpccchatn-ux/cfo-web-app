// Core Type Definitions for the Application mapped to Supabase Schema

export interface Partner {
    id: string;
    code: string;
    name: string;
    short_name?: string;
    type: 'KH' | 'DTP' | 'NCC' | 'TĐP';
    address?: string;
    tax_code?: string;
    phone?: string;
    email?: string;
    bank_account?: string;
    bank_name?: string;
    notes?: string;
    created_at?: string;
    updated_at?: string;
}

export interface Project {
    id: string;
    partner_id?: string;
    code: string;
    internal_code?: string;
    name: string;
    type: 'Thương mại' | 'Giải pháp';
    form?: 'Ký mới' | 'Mở rộng' | 'Bổ sung';
    location?: string;
    status: 'Chưa thực hiện' | 'Đang thực hiện' | 'Hoàn thành' | 'Đã xuất hóa đơn' | 'Đã thanh toán';
    description?: string;
    total_value_pre_vat: number;
    vat_percentage: number;
    total_value_post_vat: number;
    sateco_contract_ratio: number;
    sateco_actual_ratio: number;
    
    // Dates
    sign_date?: string;
    start_date?: string;
    end_date?: string;
    handover_date?: string;

    // Acting Entity
    acting_entity_key?: 'thanglong' | 'thanhphat' | 'sateco';
    company_entities?: any;

    // Financial calculations fields generated/stored
    tl_debt_after_tax?: number;
    tl_debt_paid?: number;
    st_debt_internal?: number;
    st_debt_paid?: number;

    created_at?: string;
    updated_at?: string;
}

export interface Payment {
    id: string;
    project_id: string;
    payment_code: string;
    stage_name: string;
    
    // External (CDT)
    payment_request_amount: number;
    invoice_amount: number;
    invoice_status: 'Chưa xuất' | 'Đã xuất';
    invoice_date?: string;
    due_date?: string;
    external_income: number;

    // Internal
    internal_debt_invoice: number;
    internal_debt_actual: number;
    internal_paid: number;
    internal_vat_percentage: number;

    status: 'Chưa thanh toán' | 'Đang xử lý' | 'Đã thanh toán một phần' | 'Đã thanh toán đủ';
    notes?: string;
    created_at?: string;
    updated_at?: string;

    // Supabase standard join property
    projects?: Project;
}

export interface ExternalPaymentHistory {
    id: string;
    payment_stage_id: string;
    amount: number;
    payment_date: string;
    description?: string;
    created_at?: string;
}

export interface InternalPaymentHistory {
    id: string;
    payment_stage_id: string;
    amount: number;
    payment_date: string;
    description?: string;
    created_at?: string;
}

export interface BankAccountProfile {
    id: string;
    entity_key: 'thanglong' | 'thanhphat' | 'sateco';
    profile_name: string;
    bank_name: string;
    account_number: string;
    account_holder: string;
    branch_name?: string;
    is_default: boolean;
    is_active: boolean;
    created_at?: string;
}

export interface AuditLog {
    id: string;
    action: 'CREATE' | 'UPDATE' | 'DELETE';
    table_name: string;
    record_id?: string;
    record_name?: string;
    changes?: any;
    user_id?: string;
    user_email?: string;
    created_at?: string;
}
