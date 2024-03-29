const { createJWT, isTokenValid } = require("./jwt");
const makeVerificationToken = require("./makeVerificationToken");
const checkRole = require("./checkRole");
const generateOTP = require("./generateOTP");
const sendOTPtoEmail = require("./sendOTPtoEmail");
const sendVerificationEmail = require("./sendVerificationEmail");
const getIP = require("./getIP");
const attachCookiesToResponse = require("./attachCookiesToResponse");
const paymentWithMomo = require("./paymentWithMomo");
const connectedUsers = require("./connectedUser");

module.exports = {
    createJWT,
    isTokenValid,
    makeVerificationToken,
    checkRole,
    generateOTP,
    sendOTPtoEmail,
    sendVerificationEmail,
    getIP,
    attachCookiesToResponse,
    paymentWithMomo,
    connectedUsers,
};
