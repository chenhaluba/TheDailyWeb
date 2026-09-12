function validateRole (requiredRole) {
    return function (req, res, next)  {
        try {
            const userRole = req.user.role;
            if (userRole === requiredRole) {
                next();
            } else {
                console.log(`Access denied. User doesnt have a matching role`);
                return res.status(403).json({ message: "Access Denied: You do not have permission." });
            }
        } catch (error) {
            console.error("Role validation error:", error.message);
            return res.redirect('/login');
        }
    };
};

module.exports = { validateRole };