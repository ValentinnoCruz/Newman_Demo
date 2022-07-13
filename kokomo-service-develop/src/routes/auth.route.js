const express = require('express');
const route = express.Router();
const AuthController = require('../controllers/authController');
const {isAuthorized} = require("../middlewares/authMiddleware");
route.post('/refreshJwtToken', AuthController.refreshJwtToken);
route.get('/playfab/sessiontoken', isAuthorized, AuthController.refreshPlayfabSessionToken);

module.exports = route;
