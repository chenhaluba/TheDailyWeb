const mongoose = require("mongoose");
const User = require("../models/User");
const bcrypt = require("bcrypt");



async function createUser(req, res) {
    try {
        const { username, password, displayName, role } = req.body;
        const isValidUsername = typeof username === 'string' && username.trim() !== '';
        const isValidPassword = typeof password === 'string' && password.trim() !== '';
        const isValidRole = typeof role === 'string' && (role === 'editor' || role === 'reporter');

        if (isValidUsername && isValidPassword && isValidRole) {
            const hashedPass = await bcrypt.hash(password, 10);
            const isDuplicateUser = await User.findOne({ username: username });

            if (!isDuplicateUser) {
                const newUser = await User.create({
                    username: username,
                    passwordHash: hashedPass,
                    displayName: displayName,
                    role: role,
                    isActive: true
                });
                console.log("Created user:", newUser.username);
                return res.status(201).json({ message: "User created successfully", user: newUser });
            } else {
                return res.status(400).json({ message: "username exists all ready" });
            }
        } else {
            return res.status(400).json({ message: "Invalid input data" });
        }
    } catch (error) {
        console.error("Error creating user:", error);
        return res.status(500).send("Internal Server Error");
    }
}

async function deleteUser(req, res) {
    try {
        const { username, password } = req.body;

        const user = await User.findOne({ username: username }).select('+passwordHash');
        const isValidUsername = user !== null;

        let isValidPassword = false;
        if (isValidUsername) {
            isValidPassword = await bcrypt.compare(password, user.passwordHash);
        }

        if (isValidUsername && isValidPassword) {
            await User.deleteOne({ username: username });
            res.clearCookie('token');
            return res.status(200).json({ message: "Account deleted successfully", redirect: "/login" });
        } else {
            return res.status(400).json({ message: "Invalid username or password" });
        }
    } catch (error) {
        console.error("Error deleting user:", error);
        return res.status(500).send("Internal Server Error");
    }
}

async function getAllUsers(req, res) {
    try {
        const users = await User.find({}).select('-passwordHash');
        return res.status(200).json(users);
    } catch (error) {
        console.error("Error fetching all users:", error);
        return res.status(500).send("Internal Server Error");
    }
}

async function getUser(req, res) {
    try {
        const { username } = req.params;
        const user = await User.findOne({ username: username }).select('-passwordHash');

        if (user) {
            return res.status(200).json(user);
        } else {
            return res.status(404).json({ message: "User not found" });
        }
    } catch (error) {
        console.error("Error fetching user:", error);
        return res.status(500).send("Internal Server Error");
    }
}

async function updateUser(req, res) {
    try {
        const { username, newDisplayName, newRole, newPassword, isActive } = req.body;

        const updateData = {};
        if (newDisplayName) updateData.displayName = newDisplayName;
        if (newRole) updateData.role = newRole;
        if (typeof isActive === 'boolean') updateData.isActive = isActive;

        if (newPassword) {
            updateData.passwordHash = await bcrypt.hash(newPassword, 10);
        }

        const updatedUser = await User.findOneAndUpdate(
            { username: username },
            { $set: updateData },
            { new: true }
        ).select('-passwordHash');

        if (updatedUser) {
            return res.status(200).json({ message: "User updated successfully", user: updatedUser });
        } else {
            return res.status(404).json({ message: "User not found" });
        }
    } catch (error) {
        console.error("Error updating user:", error);
        return res.status(500).send("Internal Server Error");
    }
}

module.exports = { createUser, deleteUser, getAllUsers, getUser, updateUser};