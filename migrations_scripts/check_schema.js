import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve('e:/AG/cfo-web-app/.env') });

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

async function checkSchema() {
    console.log("Checking columns in the remote 'partners' table...");
    const { data, error } = await supabase
        .from('partners')
        .select('*')
        .limit(1);

    if (error) {
        console.error("Error fetching data:", error);
    } else {
        if (data && data.length > 0) {
            console.log("Columns found:", Object.keys(data[0]));
        } else {
            console.log("Table is empty, but query succeeded.");
            // To get column names even if table is empty, we can cause an intentional error
            // or just try inserting an empty object
             const { error: insertError } = await supabase
                .from('partners')
                .insert([{ intentionally_wrong_column: 'test' }]);
            
            if (insertError) {
                console.log("Insert error details:", insertError);
            }
        }
    }
}

checkSchema();
