
const mongoose = require("mongoose");
const User = require("../models/User");
const jwt = require('jsonwebtoken');
const bcrypt = require('bcrypt');


async function login(req, res) {
  try {
    // Search the database for a matching username

    const { username, password } = req.body;

    const user = await User.findOne({ username: username });
    if (!user){
      return res.status(401).json({ message: 'No user found with that username.' });
    }

    const isPasswordMatch = await bcrypt.compare(password,user.passwordHash);

    if(isPasswordMatch)
    {
      const token = jwt.sign(
      {userID: user._id,
      role: user.role,},
      process.env.JWT_SECRET,
      {expiresIn : '1d'}
      );

      res.cookie('token', token, {
      httpOnly: true,
      maxAge: 24 * 60 * 60 * 1000
      });

      if (user.role === 'editor') {
          return res.redirect('/editor/dashboard');
      } else if (user.role === 'reporter') {
          return res.redirect('/reporter/dashboard');
      } else {
          return res.redirect('/');
      }
    }
    else{
      return res.status(401).json({ message: 'Incorrect password' });
    }
  } catch (error) {
    console.error('Error In Login', error);
    return res.status(500).json({ message: 'Error In Login' });

  }
}

module.exports = { login };