const mongoose = require("mongoose");
const validator = require("validator");

const UserSchema = new mongoose.Schema({
	username: {
		type: String,
		required: [true, "Please provide username"],
		minlength: [3, "Length must be greater than 3"],
		maxlength: [20, "Length must be less than 20"],
		trim: true,
		unique: true,
	},

	email: {
		type: String,
		required: [true, "Please provide email"],
		unique: true,
		trim: true,
		validate: {
			validator: validator.isEmail,
			message: "Please provide valid email",
		},
	},

	role: {
		type: String,
		enum: {
			values: ["vendor", "student"],
			message: "{VALUE} is not supported",
		},
	},

	ipAddresses: {
		type: [String],
		required: true,
		validate: [(val) => val.length >= 1, "Must have at least 1 IP"],
	},

	foodsLiked: {
		type: [
			{
				type: mongoose.Schema.ObjectId,
				ref: "Food",
			},
		],
		default: [],
	},

	foodsNotLiked: {
		type: [
			{
				type: mongoose.Schema.ObjectId,
				ref: "Food",
			},
		],
		default: [],
	},

	recommendFoods: {
		type: [
			{
				type: mongoose.Schema.ObjectId,
				ref: "Food",
			},
		],
		default: []
	}
});

module.exports = mongoose.model("User", UserSchema);
