const unauthorizedResponse = {
  success: false,
  message: 'A valid Bearer access token is required.',
};

export async function requireAuth(req, res, next) {
  const authorization = req.get('Authorization');
  const match = authorization?.match(/^Bearer\s+(\S+)$/i);

  if (!match) {
    return res.status(401).json(unauthorizedResponse);
  }

  const accessToken = match[1];

  let user;
  try {
    const { data, error } = await req.app.locals.supabase.auth.getUser(accessToken);
    user = error ? null : data.user;
  } catch {
    return res.status(401).json(unauthorizedResponse);
  }

  if (!user) {
    return res.status(401).json(unauthorizedResponse);
  }

  req.user = user;

  let staffProfile;
  try {
    const authenticatedSupabase =
      req.app.locals.createAuthenticatedSupabaseClient(accessToken);
    const { data, error } = await authenticatedSupabase
      .from('staff_profiles')
      .select('id, full_name, role, can_manage_inquiries, is_active')
      .eq('id', user.id)
      .eq('is_active', true)
      .maybeSingle();

    if (error) {
      return res.status(503).json({
        success: false,
        message: 'Unable to verify staff profile access.',
      });
    }

    staffProfile = data;
  } catch {
    return res.status(503).json({
      success: false,
      message: 'Unable to verify staff profile access.',
    });
  }

  if (!staffProfile) {
    return res.status(403).json({
      success: false,
      message: 'An active staff profile is required.',
    });
  }

  req.staffProfile = staffProfile;
  return next();
}

export default requireAuth;
