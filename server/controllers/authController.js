//! MODEL IMPORT
import User from "../models/userModel.js";
import sendEmail from "../utils/email.js";
import catchAsync from "../utils/catchAsync.js";
import AppError from "../utils/appError.js";

//? ENCRYPTION, AUTHENTICATION AND VERIFICATION IMPORTS
import crypto from "crypto";
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import { promisify } from "util";

const signToken = (id, email) => {
  return jwt.sign({ id, email }, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRES_IN,
  });
};

const createSendToken = (user, statusCode, res) => {
  const token = signToken(user._id, user.email);
  const cookieOptions = {
    expires: new Date(
      Date.now() + process.env.JWT_COOKIE_EXPIRES_IN * 24 * 60 * 60 * 1000
    ),
    httpOnly: true,
  };
  //Important: it is necessary to set the production and development environment (NODE_ENV) on .env file
  if (process.env.NODE_ENV === "production") cookieOptions.secure = true;

  res.cookie("jwt", token, cookieOptions);
  //Remove the password from the output
  user.password = undefined;

  res.status(statusCode).json({
    status: "success",
    token,
    data: {
      user,
    },
  });
};
//------------------- SIGN UP ---------------------

export const signup = catchAsync(async (req, res, next) => {
  const newUser = await User.create({
    name: req.body.name,
    email: req.body.email,
    password: req.body.password,
    passwordConfirm: req.body.passwordConfirm,
  });

  createSendToken(newUser, 201, res);
})

//------------------- LOG IN ----------------------

export const login = catchAsync(async (req, res, next) => {
  const { email, password } = req.body;

  //1)Check if email and password exist
  if (!email || !password)
    return res.status(400).json({
      status: "fail",
      message: "Please provide email and password",
    });

  //2)Check if user exists && password is correct
  const user = await User.findOne({ email }).select("+password");

  if (!user || !(await user.correctPassword(password, user.password)))
    return res
      .status(401)
      .json({ status: "fail", message: "Incorrect email or password" });

  //3)If everything ok, send token to client
  createSendToken(user, 200, res);
});

//------------------- PROTECT ROUTES -------------

export const protect = catchAsync(async (req, res, next) => {
  //1) Getting token and check if it's there
  let token;
  if (
    req.headers.authorization &&
    req.headers.authorization.startsWith("Bearer")
  ) {
    token = req.headers.authorization.split(" ")[1];
  }

  if (!token) {
    return next(
      new AppError("You are not logged in! Please log in to get access.", 401)
    );
  }

  //2) Verification token

  const decoded = await promisify(jwt.verify)(token, process.env.JWT_SECRET);

  //3) Check if user still exists

  const currentUser = await User.findById(decoded.id);
  if (!currentUser) {
    return next(
      new AppError(
        "The user belonging to this token does no longer exist.",
        401
      )
    );
  }

  //4) Check if user changed password after token was issue
  if (currentUser.changedPasswordAfter(decoded.iat)) {
    return next(
      new AppError("User recently changed password! Please log in again.", 401)
    );
  }
  //Grant access to protected route
  req.user = currentUser;
  next();
});

//------------------- FORGOT PASSWORD -------------

export const forgotPassword = catchAsync(async (req, res, next) => {
  //1) Get user based on POSTed email
  const user = await User.findOne({ email: req.body.email });
  if (!user) {
    return next(new AppError("There is no user with email address.", 404));
  }
  //2) Generate the random reset token
  const resetToken = user.createPasswordResetToken();
  await user.save({ validateBeforeSave: false });
  //3)Send it to user's email
  const resetURL = `${req.protocol}://${req.get(
    "host"
  )}/auth/resetPassword/${resetToken}`;

  const message = `Forgot your password? Submit a PATCH request with your new password and passwordConfirm to:${resetURL}.\nIf you didn't forget your password, please ignore this email!`;

  try {
    await sendEmail({
      email: user.email,
      subject: "Your password reset token (valid for 10 min)",
      message,
    });

    res.status(200).json({
      status: "success",
      message: "Token sent to email!",
    });
  } catch (error) {
    user.passwordResetToken = undefined;
    user.passwordResetExpires = undefined;
    await user.save({ validateBeforeSave: false });
    return next(
      new AppError(
        "There was an error sending the email. Try again later.",
        500
      )
    );
  }
});

//------------------- RESET PASSWORD -------------

export const resetPassword = async (req, res, next) => {
  //1)Get user based on the token
  const hashedToken = crypto
    .createHash("sha256")
    .update(req.params.token)
    .digest("hex");

  const user = await User.findOne({
    passwordResetToken: hashedToken,
    passwordResetExpires: { $gt: Date.now() },
  });

  //2)If token has not expired, and there is user, set the new password
  if (!user) {
    return next(new AppError("Token is invalid or has expired", 400));
  }

  user.password = req.body.password;
  user.passwordConfirm = req.body.passwordConfirm;
  user.passwordResetToken = undefined;
  user.passwordResetExpires = undefined;
  await user.save();
  //3)Update changePasswordAt property for the user
  //4)Log the user in, send JWT
  createSendToken(user, 200, res);
};

//------------------- UPDATE PASSWORD -------------
export const updatePassword = catchAsync(async (req, res, next) => {
  //1) Get user from collection
  const user = await User.findById(req.user.id).select("+password");
  //2) Check if POSTed current password is correct
  if (!(await user.correctPassword(req.body.passwordCurrent, user.password))) {
    return next(new AppError("Your current password is wrong.", 401));
  }
  //3)If so, update password
  user.password = req.body.password;
  user.passwordConfirm = req.body.passwordConfirm;
  await user.save();
  //4)Log user in, send JWT
  createSendToken(user, 200, res);
});

// //* CONTROLLER FUNCTIONS

// // http://localhost:5000/auth/register
// export const registerUser = async (req, res, next) => {
//   try {
//     const { email, password } = req.body;
//     if (!email) {
//       return res.json({ message: "Please provide an email address" });
//     }

//     const userFound = await User.findOne({ email });

//     if (userFound)
//       return res.status(401).json({
//         status: "failed",
//         message: "User with this email already exists",
//       });

//     //* PASSWORD ENCRYPTION
//     const saltRound = 15; // Determines salt rounds
//     const salt = await bcrypt.genSalt(saltRound); // Encyrption based on salt rounds

//     const hashpw = await bcrypt.hash(password, salt); // Hash Process
//     req.body.password = hashpw;

//     //* DATABASE SAVE
//     const user = new User(req.body); // Taking frontend inputs and saving them in a variable
//     await user.save(); // Saving the above variable data into the database

//     //*TOKEN CREATION

//     const payload = {
//       id: user._id,
//       email: user.email,
//     };

//     jwt.sign(
//       payload,
//       process.env.JWT_SECRET,
//       { expiresIn: "5d" },
//       (error, token) => {
//         if (error) throw error;

//         res.status(200).json({ status: "success", message: "Account created" });
//       }
//     );
//   } catch (error) {
//     next(error);
//   }
// };

// // http://localhost:5000/auth/login
// export const loginUser = async (req, res, next) => {
//   try {
//     const { email, password } = req.body;
//     const currentUser = await User.findOne({ email });

//     //* EMAIL VERIFICATION
//     if (!currentUser)
//       return res
//         .status(400)
//         .json({ status: "failed", message: "Email or Password wrong" });

//     //* PASSWORD VERIFICATION
//     const verified = await bcrypt.compare(password, currentUser.password);

//     if (!verified)
//       return res
//         .status(400)
//         .json({ status: "failed", message: "Email or Password wrong" });

//     const payLoad = {
//       email,
//     };

//     const token = jwt.sign(payLoad, process.env.JWT_SECRET, {
//       expiresIn: "5d",
//     });

//     return res.status(200).json({
//       status: "success",
//       message: `User with email ${currentUser.email} successfully logged in`,
//       data: { email: currentUser.email, token },
//     });
//   } catch (error) {
//     next(error);
//   }
// };
