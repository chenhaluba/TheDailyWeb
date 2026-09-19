
const mongoose = require("mongoose");
const User = require("../models/User");
const jwt = require('jsonwebtoken');
const bcrypt = require('bcrypt');


async function login(req, res) {
  try {
    // Search the database for a matching username

    const { username, password } = req.body;

    const user = await User.findOne({ username: username }).select('+passwordHash');
    if (!user) {
      return res.status(401).render('notFound', { pageTitle: 'Login Failed' });
    }

    const isPasswordMatch = await bcrypt.compare(password, user.passwordHash);

    if (isPasswordMatch) {
      const token = jwt.sign(
        {
          userID: user._id,
          role: user.role,
        },
        process.env.JWT_SECRET,
        { expiresIn: '1d' }
      );

      res.cookie('token', token, {
        httpOnly: true,
        maxAge: 24 * 60 * 60 * 1000
      });

      return res.redirect('/user/profile');
    }
    else {
      return res.status(401).render('notFound', { pageTitle: 'Login Failed' });
    }
  } catch (error) {
    console.error('Error In Login', error);
    return res.status(500).render('notFound', { pageTitle: 'Error' });

  }
}

const logout = (req, res) => {
  res.clearCookie('token');
  return res.redirect('/login');
};

module.exports = { login, logout };