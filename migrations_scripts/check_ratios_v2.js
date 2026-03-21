const url = 'https://omghmrvghqthfubvlyxe.supabase.co/rest/v1/projects?code=eq.YADEA&select=code,sateco_contract_ratio,sateco_actual_ratio';
const apikey = process.env.VITE_SUPABASE_ANON_KEY;

async function check() {
    try {
        const response = await fetch(url, {
            headers: {
                'apikey': apikey,
                'Authorization': `Bearer ${apikey}`
            }
        });
        const data = await response.json();
        console.log(JSON.stringify(data, null, 2));
    } catch (e) {
        console.error(e);
    }
}

check();
