import mongoose from "mongoose";

const userSchema = new mongoose.Schema(
  {
    name: { type: String, required: true },
    email: { type: String, required: true, unique: true },
    password: { type: String, required: true },
    role: {
      type: String,
      enum: ["teacher", "student", "admin"],
      default: "student",
    },
    idNumber: {
      type: String,
      unique: true,
      sparse: true,
      validate: {
        validator: function (v) {
          return !v || /^\d{7}$/.test(v);
        },
        message: "ID number must be exactly 7 digits",
      },
    },
    avatar: { type: String, default: '' },
    contribution: { type: Number, default: 0 },
    isVerified: { type: Boolean, default: false },
    otp: String,
    otpExpiry: Date,
  },
  { timestamps: true }
);

userSchema.index({ role: 1, createdAt: -1 });

const User = mongoose.model("User", userSchema);

export default User;
