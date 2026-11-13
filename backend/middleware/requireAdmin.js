const forbiddenResponse = {
  success: false,
  message: 'Admin access is required.',
};

export function requireAdmin(req, res, next) {
  if (req.staffProfile?.role !== 'admin') {
    return res.status(403).json(forbiddenResponse);
  }

  return next();
}

export default requireAdmin;
