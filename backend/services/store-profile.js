const { supabaseAdmin } = require('../database/supabase');

async function getStoreProfile() {
    const { data, error } = await supabaseAdmin.rpc('catalog_store_hours_link');
    if (error) throw error;
    const profile = Array.isArray(data) ? data[0] : data;
    const { open_time, close_time, location_url, facebook_url } = profile;
    const format = value => {
        const [hour, minute] = value.split(':').map(Number);
        const suffix = hour >= 12 ? 'PM' : 'AM';
        return `${hour % 12 || 12}:${String(minute).padStart(2, '0')} ${suffix}`;
    };
    return { open_time, close_time, label: `${format(open_time)} - ${format(close_time)}`, location_url, facebook_url };
}

module.exports = { getStoreProfile };
