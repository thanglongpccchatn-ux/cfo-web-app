import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

// Parse .env file manually to avoid dependency issues in raw Node
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const envPath = path.resolve(__dirname, '.env');
const envContent = fs.readFileSync(envPath, 'utf8');
const supabaseUrl = envContent.match(/VITE_SUPABASE_URL=(.*)/)[1].trim();
const supabaseKey = envContent.match(/VITE_SUPABASE_ANON_KEY=(.*)/)[1].trim();

const OD_MAPPING = {
    15: 21.2,
    20: 26.8,
    25: 33.5,
    32: 42.2,
    40: 48.1,
    50: 60.0,
    65: 75.6,
    80: 88.3,
    100: 113.5,
    125: 140.0,
    150: 168.3,
    200: 219.1,
    250: 273.0,
    300: 323.8
};

async function updateWeights() {
    console.log("Fetching materials from database...");
    
    // 1. Fetch materials
    const res = await fetch(`${supabaseUrl}/rest/v1/materials?select=id,name,weight_per_unit&name=ilike.*ống thép*&limit=5000`, {
        headers: {
            'apikey': supabaseKey,
            'Authorization': `Bearer ${supabaseKey}`
        }
    });
    
    const materials = await res.json();
    console.log(`Found ${materials.length} steel pipes.`);
    
    let updateCount = 0;
    
    for (const mat of materials) {
        // If weight already exists and > 0, skip
        if (mat.weight_per_unit > 0) continue;
        
        // Match things like "DN32 3,2mm", "DN150 4.0mm", "DN 80 2.9mm", "DN50 SCH40 dày 3,91mm"
        const regex = /DN\s*(\d+).*?(?:dày\s*)?(\d+[,.]\d+)\s*mm/i;
        const match = mat.name.match(regex);
        
        if (match) {
            const dn = parseInt(match[1]);
            const thickness = parseFloat(match[2].replace(',', '.'));
            
            const od = OD_MAPPING[dn];
            if (od) {
                // Standard formula: (OD - t) * t * 0.02466
                let weight = (od - thickness) * thickness * 0.02466;
                weight = Math.round(weight * 100) / 100; // Round to 2 decimals
                
                console.log(`Updating ${mat.name} -> DN: ${dn}, t: ${thickness}, OD: ${od} -> ${weight} kg/m`);
                
                // Perform PATCH update
                await fetch(`${supabaseUrl}/rest/v1/materials?id=eq.${mat.id}`, {
                    method: 'PATCH',
                    headers: {
                        'apikey': supabaseKey,
                        'Authorization': `Bearer ${supabaseKey}`,
                        'Content-Type': 'application/json',
                        'Prefer': 'return=minimal'
                    },
                    body: JSON.stringify({ weight_per_unit: weight })
                });
                updateCount++;
            } else {
                console.warn(`Could not find OD mapping for DN${dn} in: ${mat.name}`);
            }
        }
    }
    
    console.log(`\n✅ Done! Successfully calculated and updated weights for ${updateCount} pipes.`);
}

updateWeights().catch(console.error);
