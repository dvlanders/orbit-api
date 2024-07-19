const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.SUPABASE_SANDBOX_URL;
const supabaseServiceRoleKey = process.env.SUPABASE_SANDBOX_SERVICE_ROLE_KEY;

const supabaseSandbox = createClient(supabaseUrl, supabaseServiceRoleKey);

module.exports = supabaseSandbox;
