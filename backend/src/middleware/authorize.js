/**
 * Role-based authorization middleware.
 * Must be used AFTER authMiddleware (req.user must exist).
 *
 * Usage: authorize('admin', 'manager')
 */
function authorize(...allowedRoles) {
  return (req, res, next) => {
    if (!req.user || !allowedRoles.includes(req.user.role)) {
      return res.status(403).json({ error: '권한이 없습니다.' });
    }
    next();
  };
}

module.exports = authorize;
