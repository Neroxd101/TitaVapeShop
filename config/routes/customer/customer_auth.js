const express = require('express');
const router = express.Router();

// Modular customer route handlers matching Supabase RPC names 1-to-1
const checkEmailRoutes = require('./customer_check_email');
const checkPhoneRoutes = require('./customer_check_phone');
const registerRoutes = require('./customer_register');
const verifyOtpRoutes = require('./customer_verify_otp');
const generateOtpRoutes = require('./customer_generate_otp');
const loginRoutes = require('./customer_login');
const updateProfileRoutes = require('./customer_update_profile');
const resetPasswordRoutes = require('./customer_reset_password');
const changePasswordRoutes = require('./customer_change_password');
const createOrderRoutes = require('./customer_create_order');
const getOrdersRoutes = require('./customer_get_orders');

// Mount all modular routes
router.use('/', checkEmailRoutes);
router.use('/', checkPhoneRoutes);
router.use('/', registerRoutes);
router.use('/', verifyOtpRoutes);
router.use('/', generateOtpRoutes);
router.use('/', loginRoutes);
router.use('/', updateProfileRoutes);
router.use('/', resetPasswordRoutes);
router.use('/', changePasswordRoutes);
router.use('/', createOrderRoutes);
router.use('/', getOrdersRoutes);

module.exports = router;
