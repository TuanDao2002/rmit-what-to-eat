const { StatusCodes } = require("http-status-codes");
const CustomError = require("../errors");
const {
    isTokenValid,
    makeVerificationToken,
    checkRole,
    generateOTP,
    sendOTPtoEmail,
    sendVerificationEmail,
    getIP,
    attachCookiesToResponse,
} = require("../utils");

const User = require("../models/User");
const Token = require("../models/Token");

const useragent = require("express-useragent");
const crypto = require("crypto");

const register = async (req, res) => {
    const { username, email } = req.body;

    if (username.length < 3 || username.length > 20) {
        throw new CustomError.BadRequestError(
            "The username must have from 3 to 20 characters"
        );
    }

    const role = checkRole(username, email);

    const findUsername = await User.findOne({
        username: { $regex: `^${username}$`, $options: "i" }, // find duplicate username with case insensitive
    });

    if (findUsername) {
        throw new CustomError.BadRequestError("This username already exists");
    }

    const findEmail = await User.findOne({ email });
    if (findEmail) {
        throw new CustomError.BadRequestError("This email already exists");
    }

    const minutesToExpire = 2;
    const verificationToken = makeVerificationToken(
        username,
        email,
        role,
        process.env.VERIFICATION_SECRET,
        minutesToExpire
    );

    const origin = process.env.NODE_ENV === "dev" ? "http://localhost:3000" : process.env.REACT_APP_LINK; // later this is the origin link of Netlify client side
    await sendVerificationEmail(
        req.useragent.browser,
        email,
        verificationToken,
        origin
    );

    res.status(StatusCodes.CREATED).json({
        msg: "Please check your email to verify your account!",
    });
};

const verifyEmail = async (req, res) => {
    const { verificationToken } = req.body;
    if (!verificationToken) {
        throw new CustomError.UnauthenticatedError("Cannot verify user");
    }

    let decoded;
    try {
        decoded = isTokenValid(
            verificationToken,
            process.env.VERIFICATION_SECRET
        );
    } catch {
        throw new CustomError.UnauthenticatedError("Verification Failed");
    }

    if (
        !decoded.hasOwnProperty("username") ||
        !decoded.hasOwnProperty("email") ||
        !decoded.hasOwnProperty("role") ||
        !decoded.hasOwnProperty("expirationDate")
    ) {
        throw new CustomError.UnauthenticatedError("Verification Failed");
    }

    const { username, email, role, expirationDate } = decoded;
    const now = new Date();

    if (new Date(expirationDate).getTime() <= now.getTime()) {
        throw new CustomError.UnauthenticatedError(
            "Verification token is expired after 2 minutes"
        );
    }

    const findUser = await User.findOne({ email });
    if (findUser) {
        throw new CustomError.UnauthenticatedError("Email is already verified");
    }

    const ip = getIP(req);
    const user = await User.create({
        username,
        email,
        role,
        ipAddresses: [ip],
    });

    res.status(StatusCodes.OK).json({
        msg: `Account with username: ${user.username} is created!`,
    });
};

const login = async (req, res) => {
    const { username } = req.body;
    const findUser = await User.findOne({ username });
    if (!findUser) {
        throw new CustomError.BadRequestError("This account does not exist");
    }

    const otp = generateOTP();
    const expires = Date.now() + 1.5 * 60 * 1000; // expires after 90 seconds
    const data = `${username}.${otp}.${expires}`;
    const hash = crypto
        .createHmac("sha256", process.env.HASH_SECRET)
        .update(data)
        .digest("hex");
    const fullHash = `${hash}.${expires}`;

    const ip = getIP(req);
    if (!findUser.ipAddresses.includes(ip)) {
        await sendOTPtoEmail(findUser.email, otp, req.useragent.browser);
        res.status(StatusCodes.OK).json({
            hash: fullHash,
            msg: "Login from different IP. If this is your device, check your email for OTP to login",
        });
        return;
    }

    res.status(StatusCodes.OK).json({
        hash: fullHash,
        msg: `Check your email for OTP to login`,
    });

    await sendOTPtoEmail(findUser.email, otp, null);
};

const verifyOTP = async (req, res) => {
    const { username, otp, hash } = req.body;
    const findUser = await User.findOne({ username });
    if (!findUser) {
        throw new CustomError.BadRequestError("This account does not exist");
    }

    const [hashValue, expires] = hash.split(".");

    const now = Date.now();
    if (now > parseInt(expires)) {
        throw new CustomError.UnauthenticatedError(
            "OTP is expired after 90 seconds"
        );
    }

    const data = `${username}.${otp}.${expires}`;
    const newCalculatedHash = crypto
        .createHmac("sha256", process.env.HASH_SECRET)
        .update(data)
        .digest("hex");
    if (newCalculatedHash === hashValue) {
        const ip = getIP(req);
        if (!findUser.ipAddresses.includes(ip)) {
            findUser.ipAddresses.push(req.ip);
            await findUser.save();
        }

        const tokenUser = {
            username: findUser.username,
            email: findUser.email,
            userId: findUser._id,
            role: findUser.role,
        };

        let refreshToken = "";
        const existingToken = await Token.findOne({ user: findUser._id });

        if (existingToken) {
            refreshToken = existingToken.refreshToken;
            attachCookiesToResponse({ res, user: tokenUser, refreshToken });
            res.status(StatusCodes.OK).json({ user: tokenUser });
            return;
        }

        refreshToken = crypto.randomBytes(40).toString("hex");
        const userAgent = req.headers["user-agent"];
        const userToken = { refreshToken, ip, userAgent, user: findUser._id };

        await Token.create(userToken);

        attachCookiesToResponse({ res, user: tokenUser, refreshToken });

        res.status(StatusCodes.OK).json({ user: tokenUser });
    } else {
        throw new CustomError.UnauthenticatedError("Login Failed");
    }
};

const logout = async (req, res) => {
    await Token.findOneAndDelete({ user: req.user.userId });

    res.cookie("accessToken", "logout", {
        httpOnly: true,
        expires: new Date(Date.now()),
    });
    res.cookie("refreshToken", "logout", {
        httpOnly: true,
        expires: new Date(Date.now()),
    });
    res.status(StatusCodes.OK).json({ msg: "Logged out successfully!" });
};

module.exports = {
    register,
    verifyEmail,
    login,
    verifyOTP,
    logout,
};
