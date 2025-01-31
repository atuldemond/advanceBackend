import { asyncHandler } from "../utils/asyncHandler.js";
import { ApiError } from "../utils/ApiError.js";
import { User } from "../model/user.model.js";
import { uploadOnCloudinary } from "../utils/cloudinary.js";
import { ApiResponse } from "../utils/ApiResponse.js";
import fs from "fs";
import mongoose from "mongoose";
import jwt from "jsonwebtoken";
import { json } from "stream/consumers";

const genrateAccessTokenAndRefreshToken = async (userId) => {
  try {
    const user = await User.findById(userId);
    const accessToken = user.genrateAccessToken();
    const refreshToken = user.genrateRefreshToken();

    user.refreshToken = refreshToken;
    await user.save({ validateBeforeSave: false });
    return { accessToken, refreshToken };
  } catch (error) {
    throw new ApiError(404, "Some thing went Wrong in Acess and Refesh Token ");
  }
};

const registerUser = asyncHandler(async (req, res) => {
  //get user details from frontend
  const { name, username, email, password } = req.body;
  // validation check if empty or not
  if ([name, username, email, password].some((field) => field?.trim() === "")) {
    throw new ApiError(400, "All field are complusary ");
  }
  //check if user already exist or not by email or username
  const existedUser = await User.findOne({
    $or: [{ username }, { email }],
  });

  if (existedUser) {
    throw new ApiError(409, "User Already Existed");
  }
  //check for images or check for avtar
  const avatarLocalPath = req.files?.avatar[0]?.path;
  const coverImageLocalPath = req.files?.coverImage[0]?.path; // Corrected to coverImage

  // Log the file paths
  console.log(`Avatar local path: ${avatarLocalPath}`);
  console.log(`Cover image local path: ${coverImageLocalPath}`);

  // Ensure the files exist before proceeding
  if (!fs.existsSync(avatarLocalPath)) {
    console.error(`Avatar file not found: ${avatarLocalPath}`);
    throw new ApiError(400, `Avatar file not found: ${avatarLocalPath}`);
  }
  if (!fs.existsSync(coverImageLocalPath)) {
    console.error(`Cover image file not found: ${coverImageLocalPath}`);
    throw new ApiError(
      400,
      `Cover image file not found: ${coverImageLocalPath}`
    );
  }

  if (!avatarLocalPath) {
    throw new ApiError(400, "Avatar Image is Required");
  }
  //upload them to cloudinary or avatar
  let avatar, coverImage;
  try {
    avatar = await uploadOnCloudinary(avatarLocalPath);
    // Only upload coverImage if it's different from avatar
    if (avatarLocalPath !== coverImageLocalPath) {
      coverImage = await uploadOnCloudinary(coverImageLocalPath);
    } else {
      coverImage = avatar;
    }
  } catch (error) {
    console.error(`Error uploading images to Cloudinary: ${error.message}`);
    throw new ApiError(
      500,
      `Error uploading images to Cloudinary: ${error.message}`
    );
  }

  if (!avatar) {
    throw new ApiError(409, "Avatar is not found");
  }

  //create user entry in object - creation user in db

  const user = await User.create({
    name,
    email,
    password,
    avatar: avatar.url,
    coverImage: coverImage?.url || "",
    username: username.toLowerCase(),
  });
  //remover password or refresh token from reqsponse field

  //check for user creation
  const createdUser = await User.findById(user._id).select(
    "-password -refreshToken"
  );
  if (!createdUser) {
    throw new ApiError(500, "user Not Craeted");
  }
  //restuen res

  res
    .status(200)
    .json(new ApiResponse(200, createdUser, "User register Sucessfully"));
});

const userLogin = asyncHandler(async (req, res) => {
  // username and email and password {req.body}
  const { username, email, password } = req.body;
  //username and email
  if (!(username || email)) {
    throw new ApiError(400, "username and email is required");
  }
  //find by user
  const user = await User.findOne({
    $or: [{ email }, { username }],
  });

  if (!user) {
    throw new ApiError(400, "user doesnot Exist");
  }
  //password
  const isPassWordValid = await user.isPasswordCorrect(password);
  if (!isPassWordValid) {
    throw new ApiError(400, "password is Wrong");
  }
  //acces token and refresh token
  const { accessToken, refreshToken } = await genrateAccessTokenAndRefreshToken(
    user._id
  );

  // Log the generated tokens

  // console.log(`Refresh Token: ${JSON.stringify(refreshToken)}`);
  // console.log(`Refresh Token: ${JSON.stringify(accessToken)}`);
  // // send cookies
  const loggedInUser = await User.findById(user._id).select(
    "-password -refreshToken"
  );
  const options = {
    httpOnly: true,
    secure: true,
  };

  return res
    .status(200)
    .cookie("accessToken", accessToken, options)
    .cookie("refreshToken", refreshToken, options)
    .json(
      new ApiResponse(
        200,
        {
          user: loggedInUser,
          accessToken,
          refreshToken,
        },
        "USER LOGGEDIN SUCESSFULLY"
      )
    );
});

const userLogout = asyncHandler(async (req, res) => {
  User.findByIdAndUpdate(
    req.user._id,
    {
      $set: {
        refreshToken: undefined,
      },
    },
    {
      new: true,
    }
  );
  const options = {
    httpOnly: true,
    secure: true,
  };
  res.clearCookie("accessToken", options);
  res.clearCookie("refreshToken", options);

  return res
    .status(200)
    .json(new ApiResponse(200, null, "User logged out successfully"));
});

const refreshToken = asyncHandler(async (req, res) => {
  // console.log(`Cookies: ${JSON.stringify(req.cookies)}`); // Log cookies
  // console.log(`Body: ${JSON.stringify(req.body)}`); // Log body

  const incomingRefreshToken =
    req.cookies?.refreshToken || req.body.refreshToken;
  if (!incomingRefreshToken) {
    return res
      .status(404)
      .json(new ApiError(404, "Unable to get Refresh token"));
  }

  try {
    const decodedToken = jwt.verify(
      incomingRefreshToken,
      process.env.REFRESH_TOKEN_SECRET
    );

    const user = await User.findById(decodedToken?._id);
    if (!user) {
      return res
        .status(404)
        .json(
          new ApiError(404, "Unable to get user from decoded Refresh Token")
        );
    }
    if (incomingRefreshToken !== user?.refreshToken) {
      return res
        .status(404)
        .json(
          new ApiError(
            404,
            "DB refresh token and incoming refresh token do not match"
          )
        );
    }

    const options = {
      httpOnly: true,
      secure: true,
    };

    // Generate new tokens
    const { accessToken, refreshToken } =
      await genrateAccessTokenAndRefreshToken(user._id);

    // Clear old cookies and set new ones
    // res.clearCookie("accessToken", options);
    // res.clearCookie("refreshToken", options);
    res.cookie("accessToken", accessToken, options);
    res.cookie("refreshToken", refreshToken, options);

    return res
      .status(200)
      .json(
        new ApiResponse(
          200,
          { accessToken, refreshToken },
          "Tokens refreshed successfully"
        )
      );
  } catch (error) {
    console
      .error(`Refresh token error: ${error.message}`)
      .status(500)
      .json(new ApiError(500, "Unable to generate refresh token"));
  }
});

export { registerUser, userLogin, userLogout, refreshToken };
