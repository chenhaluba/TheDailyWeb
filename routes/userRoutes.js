const express = require('express');
const router = express.Router();
const User = require('../models/User');

const { createUser, deleteUser, getAllUsers, getUser, updateUser } = require('../controllers/userController');
const { validateSession } = require('../middleware/authMiddleware');
const { validateRole } = require('../middleware/roleMiddleware');

router.get('/', validateSession, validateRole('editor'), getAllUsers);

router.get('/profile', validateSession, async (req, res) => {
    try {
        const user = await User.findById(req.user.userID);
        res.render('user/profile', { pageTitle: 'My Profile', user: user });
    } catch (err) {
        console.error(err);
        res.status(500).send("Error loading profile");
    }
});

router.get('/:username', validateSession, validateRole('editor'), getUser);


router.post('/', validateSession, validateRole('editor'), createUser);

router.put('/', validateSession, updateUser);

router.delete('/', validateSession, deleteUser);
module.exports = router;