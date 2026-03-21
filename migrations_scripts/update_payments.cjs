const { createClient } = require('@supabase/supabase-client');
const fs = require('fs');
const path = require('path');

// Read .env file
const envPath = path.join(__dirname, '.env');
const env = fs.readFileSync(envPath, 'utf8');
const url = env.match(/VITE_SUPABASE_URL=(.*)/)[1].trim();
const key = env.match(/VITE_SUPABASE_ANON_KEY=(.*)/)[1].trim();

const supabase = createClient(url, key);

async function updatePayments() {
    console.log('Fetching projects and payments...');
    
    const { data: projects, error: pError } = await supabase
        .from('projects')
        .select('id, sateco_contract_ratio, sateco_actual_ratio');
        
    if (pError) {
        console.error('Error fetching projects:', pError);
        return;
    }

    const projectMap = {};
    projects.forEach(p => {
        projectMap[p.id] = {
            contractRatio: (p.sateco_contract_ratio || 98) / 100,
            actualRatio: (p.sateco_actual_ratio || 95.5) / 100
        };
    });

    const { data: payments, error: payError } = await supabase
        .from('payments')
        .select('id, project_id, invoice_amount, payment_request_amount, internal_debt_invoice, internal_debt_actual');

    if (payError) {
        console.error('Error fetching payments:', payError);
        return;
    }

    console.log(`Processing ${payments.length} records...`);

    let updatedCount = 0;
    for (const pay of payments) {
        // Update if values are 0 or null
        const needsUpdate = (Number(pay.internal_debt_invoice) === 0 && Number(pay.invoice_amount) > 0) || 
                          (Number(pay.internal_debt_actual) === 0 && Number(pay.payment_request_amount) > 0);
        
        if (needsUpdate) {
            const ratios = projectMap[pay.project_id] || { contractRatio: 0.98, actualRatio: 0.955 };
            const newInvoiceDebt = Math.round(Number(pay.invoice_amount || 0) * ratios.contractRatio);
            const newActualDebt = Math.round(Number(pay.payment_request_amount || 0) * ratios.actualRatio);

            const { error: updateError } = await supabase
                .from('payments')
                .update({
                    internal_debt_invoice: newInvoiceDebt,
                    internal_debt_actual: newActualDebt
                })
                .eq('id', pay.id);

            if (updateError) {
                console.error(`Error updating payment ${pay.id}:`, updateError);
            } else {
                updatedCount++;
            }
        }
    }

    console.log(`Successfully updated ${updatedCount} records.`);
}

updatePayments().catch(console.error);
