const unauthorizedResponse = {
  success: false,
  message: 'A valid Bearer access token is required.',
};

async function authenticateUser(req, res) {
  const authorization = req.get('Authorization');
  const match = authorization?.match(/^Bearer\s+(\S+)$/i);

  if (!match) {
    res.status(401).json(unauthorizedResponse);
    return false;
  }

  const accessToken = match[1];

  let user;
  try {
    const { data, error } = await req.app.locals.supabase.auth.getUser(accessToken);
    user = error ? null : data.user;
  } catch {
    res.status(401).json(unauthorizedResponse);
    return false;
  }

  if (!user) {
    res.status(401).json(unauthorizedResponse);
    return false;
  }

  req.user = user;
  req.accessToken = accessToken;
  return true;
}

export async function requireAuthenticatedUser(req, res, next) {
  if (await authenticateUser(req, res)) {
    return next();
  }
}

export async function requireAuth(req, res, next) {
  if (!await authenticateUser(req, res)) {
    return;
  }

  let staffProfile;
  try {
    const authenticatedSupabase =
      req.app.locals.createAuthenticatedSupabaseClient(req.accessToken);
    const { data, error } = await authenticatedSupabase
      .from('staff_profiles')
      .select('id, full_name, role, can_manage_inquiries, is_active')
      .eq('id', req.user.id)
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
