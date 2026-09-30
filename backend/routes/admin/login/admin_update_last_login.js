// Internal login bookkeeping; the browser cannot choose another user's timestamp.
const { supabaseAdmin } = require('../../../database/supabase');

async function adminUpdateLastLogin(userId) {
  return supabaseAdmin.rpc('admin_update_last_login', { p_user_id: userId });
}

module.exports = { adminUpdateLastLogin };
