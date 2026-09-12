const jwt = require('jsonwebtoken');

const validateSession  = (req, res,next) =>{
    const token = req.cookies.token;
    if(!token)
    {
        console.log("no jwt token");
        return res.redirect('/login');
    }
    try{
        const decodeToken = jwt.verify(token, process.env.JWT_SECRET);
        req.user = decodeToken;
        next();

    }
    catch (error){
        console.error("Token validation error:", error.message);
        return res.redirect('/login');
    }
}

module.exports = { validateSession };