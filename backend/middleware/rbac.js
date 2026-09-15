/**
 * Restricts a route to a given set of roles.
 * Usage: requireRole('doctor', 'admin')
 */
function requireRole(...allowedRoles) {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ error: 'Not authenticated.' });
    }
    if (!allowedRoles.includes(req.user.role)) {
      return res.status(403).json({
        error: `Access denied. Requires role: ${allowedRoles.join(' or ')}.`
      });
    }
    next();
  };
}

module.exports = { requireRole };
