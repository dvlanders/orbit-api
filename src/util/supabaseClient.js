const { createClient } = require('@supabase/supabase-js');

// Supabase service role key or anon key should be kept secure
// Store these values in environment variables
const supabaseUrl = process.env.SUPABASE_URL; // Replace SUPABASE_URL with your actual Supabase project URL in your .env file
const supabaseKey = process.env.SUPABASE_KEY; // Replace SUPABASE_KEY with your actual Supabase service role key in your .env file

const supabase = createClient(supabaseUrl, supabaseKey);

module.exports = supabase;
