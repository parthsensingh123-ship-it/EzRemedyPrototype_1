const { supabaseAdmin } = require('../config/supabaseClient');

/**
 * Verifies the Supabase JWT sent in the Authorization header
 * (format: "Bearer <access_token>"), attaches the authenticated
 * user and their profile (including role) to req.user.
 */
async function authenticate(req, res, next) {
  const authHeader = req.headers.authorization || '';
  const token = authHeader.startsWith('Bearer ')
    ? authHeader.slice(7)
    : null;

  if (!token) {
    return res.status(401).json({ error: 'Missing authentication token.' });
  }

  const { data: userData, error: userError } = await supabaseAdmin.auth.getUser(token);

  if (userError || !userData || !userData.user) {
    return res.status(401).json({ error: 'Invalid or expired token.' });
  }

  const { data: profile, error: profileError } = await supabaseAdmin
    .from('profiles')
    .select('id, full_name, role, phone, specialization, bio, years_experience')
    .eq('id', userData.user.id)
    .single();

  if (profileError || !profile) {
    return res.status(403).json({ error: 'No profile found for this account.' });
  }

  req.user = {
    id: userData.user.id,
    email: userData.user.email,
    ...profile
  };

  next();
}

module.exports = { authenticate };
