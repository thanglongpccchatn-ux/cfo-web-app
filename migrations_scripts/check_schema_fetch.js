const url = 'https://laoadqoisidnbgaqjsbw.supabase.co/rest/v1/partners?limit=1';
const key = 'sb_publishable_HZhvUIQXNF99JLK7RGZBOA_Amkh_7Bf';

async function check() {
    console.log("Fetching schema...");
    try {
        const res = await fetch(url, {
            headers: { 'apikey': key, 'Authorization': `Bearer ${key}` }
        });
        const data = await res.json();
        
        if (data && data.length > 0) {
            console.log("✅ Rows found! Columns are:", Object.keys(data[0]));
        } else {
            console.log("Table is empty. Sending a dummy insert to reveal columns...");
            const errRes = await fetch('https://laoadqoisidnbgaqjsbw.supabase.co/rest/v1/partners', {
                method: 'POST',
                headers: {
                    'apikey': key,
                    'Authorization': `Bearer ${key}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ dummy_column_to_trigger_error: 'test' })
            });
            const errData = await errRes.json();
            console.log("Error response:", errData);
        }
    } catch (e) {
        console.error("Fetch error:", e);
    }
}

check();
