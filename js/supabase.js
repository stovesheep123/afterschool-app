// js/supabase.js

const SUPABASE_URL = "https://mepmvfsjcuittupztifp.supabase.co";
const SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1lcG12ZnNqY3VpdHR1cHp0aWZwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzYxMjEzODUsImV4cCI6MjA5MTY5NzM4NX0.lhm0aLvxsLTTGwKetwSStro-nKXIqdMBfiPq4Gl6HU4";

// ✅ correct global usage from CDN
const supabaseClient = window.supabase.createClient(
    SUPABASE_URL,
    SUPABASE_KEY
);

// DEBUG (VERY IMPORTANT)
console.log("✅ Supabase Ready:", supabaseClient);