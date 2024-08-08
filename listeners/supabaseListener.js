const supabase = require("../src/util/supabaseClient");
const supabaseSandbox = require("../src/util/sandboxSupabaseClient");
const { supabaseCall } = require("../src/util/supabaseWithRetry");
const { sendSlackNewCustomerMessage } = require("../src/util/logger/slackLogger");
const createLog = require("../src/util/logger/supabaseLogger");

supabase
  .channel('table_db_changes')
  .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'profiles' }, payload => {
    console.log('New Profile Record Received!', payload)
    const fullName = payload.new.full_name;
    const email = payload.new.email;
    sendSlackNewCustomerMessage(fullName, email);
    const { error: newSandboxProfileError } = supabaseCall(() => supabaseSandbox
					.from("profiles")
					.insert(payload.new));
		if (newSandboxProfileError){
      console.error(newSandboxProfileError);
      createLog("listeners/supabaseListener", null, "Sandbox Profile Insertion Error", newSandboxProfileError, payload.new.id);
    }
  })
  .subscribe()