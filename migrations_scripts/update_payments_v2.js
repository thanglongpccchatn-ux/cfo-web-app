import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Read .env file
const envPath = path.join(__dirname, '.env');
const env = fs.readFileSync(envPath, 'utf8');
const urlMatch = env.match(/VITE_SUPABASE_URL=(.*)/);
const keyMatch = env.match(/VITE_SUPABASE_ANON_KEY=(.*)/);

if (!urlMatch || !keyMatch) {
    console.error('Could not find Supabase credentials in .env');
    process.exit(1);
}

const url = urlMatch[1].trim();
const key = keyMatch[1].trim();

async function updatePayments() {
    console.log('Fetching projects and payments via REST API...');
    
    // Fetch Projects
    const pResponse = await fetch(`${url}/rest/v1/projects?select=id,sateco_contract_ratio,sateco_actual_ratio`, {
        headers: {
            'apikey': key,
            'Authorization': `Bearer ${key}`
        }
    });
    const projects = await pResponse.json();
    
    const projectMap = {};
    projects.forEach(p => {
        projectMap[p.id] = {
            contractRatio: (p.sateco_contract_ratio || 98) / 100,
            actualRatio: (p.sateco_actual_ratio || 95.5) / 100
        };
    });

    // Fetch Payments
    const payResponse = await fetch(`${url}/rest/v1/payments?select=id,project_id,invoice_amount,payment_request_amount,internal_debt_invoice,internal_debt_actual`, {
        headers: {
            'apikey': key,
            'Authorization': `Bearer ${key}`
        }
    });
    const payments = await payResponse.json();

    console.log(`Processing ${payments.length} records...`);

    let updatedCount = 0;
    for (const pay of payments) {
        const needsUpdate = (Number(pay.internal_debt_invoice || 0) === 0 && Number(pay.invoice_amount || 0) > 0) || 
                          (Number(pay.internal_debt_actual || 0) === 0 && Number(pay.payment_request_amount || 0) > 0);
        
        if (needsUpdate) {
            const ratios = projectMap[pay.project_id] || { contractRatio: 0.98, actualRatio: 0.955 };
            const newInvoiceDebt = Math.round(Number(pay.invoice_amount || 0) * ratios.contractRatio);
            const newActualDebt = Math.round(Number(pay.payment_request_amount || 0) * ratios.actualRatio);

            const updateResponse = await fetch(`${url}/rest/v1/payments?id=eq.${pay.id}`, {
                method: 'PATCH',
                headers: {
                    'apikey': key,
                    'Authorization': `Bearer ${key}`,
                    'Content-Type': 'application/json',
                    'Prefer': 'return=minimal'
                },
                body: JSON.stringify({
                    internal_debt_invoice: newInvoiceDebt,
                    internal_debt_actual: newActualDebt
                })
            });

            if (!updateResponse.ok) {
                console.error(`Error updating payment ${pay.id}:`, await updateResponse.text());
            } else {
                updatedCount++;
            }
        }
    }

    console.log(`Successfully updated ${updatedCount} records.`);
}

updatePayments().catch(console.error);
