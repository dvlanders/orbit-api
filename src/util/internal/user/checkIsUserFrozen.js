const supabase = require('../../supabaseClient');
const { supabaseCall } = require('../../supabaseWithRetry');

const isUserFrozen = async (profileId, route) => {

    // Strip away the /dashboard prefix if it exists
    if (route.startsWith('/dashboard')) {
        route = route.replace('/dashboard', '');
    }

    const { data: frozenUser, error: frozenError } = await supabaseCall(() =>
        supabase
            .from('frozen_users')
            .select()
            .eq('profile_id', profileId)
            .eq('route', route)
            .maybeSingle()
    );

    if (frozenError) throw frozenError;

    return frozenUser;
}

module.exports = {
    isUserFrozen,
};
