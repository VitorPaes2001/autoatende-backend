const { createClient } = require("@supabase/supabase-js");

async function main() {
  const companyId = process.argv[2];
  if (!companyId) {
    console.log("USAGE: node scripts/c1a_validate_company_commercial_profiles_shape.js <company_id>");
    process.exit(1);
  }

  const url =
    process.env.SUPABASE_URL ||
    process.env.NEXT_PUBLIC_SUPABASE_URL ||
    process.env.VITE_SUPABASE_URL;

  const key =
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
    process.env.SUPABASE_SERVICE_KEY ||
    process.env.SUPABASE_ANON_KEY ||
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
    process.env.VITE_SUPABASE_ANON_KEY;

  if (!url || !key) {
    console.log("VALIDATION_ERROR=SUPABASE_ENV_MISSING");
    process.exit(2);
  }

  const supabase = createClient(url, key, { auth: { persistSession: false } });

  const { data, error } = await supabase
    .from("company_commercial_profiles")
    .select("*")
    .eq("company_id", companyId)
    .maybeSingle();

  if (error) {
    console.log(`VALIDATION_ERROR=${String(error.message || error)}`);
    process.exit(3);
  }

  if (!data) {
    console.log("VALIDATION_RESULT=NO_ROW_FOUND");
    process.exit(0);
  }

  console.log("VALIDATION_RESULT=ROW_FOUND");
  console.log(`FIELDS=${Object.keys(data).join(",")}`);
  console.log(`COMPANY_NAME=${String(data.company_name || "")}`);
  console.log(`ONBOARDING_COMPLETED=${String(Boolean(data.onboarding_completed))}`);
  console.log(`SOURCE=${String(data.source || "")}`);
}

main().catch((error) => {
  console.log(`VALIDATION_FATAL=${String(error.message || error)}`);
  process.exit(10);
});
