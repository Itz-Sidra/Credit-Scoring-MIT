import BorrowerProfile from "../models/BorroweProfile.js";

export const createProfile = async (req, res) => {
  try {
    const userId = req.user?._id;

    if (!userId) {
      return res.status(401).json({ message: "Unauthorized" });
    }

    const existingProfile = await BorrowerProfile.findOne({ userId });

    if (existingProfile) {
      return res
        .status(400)
        .json({ message: "Profile already exists, use PATCH to update" });
    }

    const profile = new BorrowerProfile({
      userId,
      ...req.body,
    });

    const savedProfile = await profile.save();

    return res.status(201).json({ profile: savedProfile });
  } catch (error) {
    return res.status(500).json({
      message: "Error creating borrower profile",
      error: error.message,
    });
  }
};

export const getProfile = async (req, res) => {
  try {
    const userId = req.user?._id;

    if (!userId) {
      return res.status(401).json({ message: "Unauthorized" });
    }

    const profile = await BorrowerProfile.findOne({ userId });

    if (!profile) {
      return res.status(404).json({ message: "Borrower profile not found" });
    }

    return res.status(200).json({ profile });
  } catch (error) {
    return res.status(500).json({
      message: "Error fetching borrower profile",
      error: error.message,
    });
  }
};

export const updateProfile = async (req, res) => {
  try {
    const userId = req.user?._id;

    if (!userId) {
      return res.status(401).json({ message: "Unauthorized" });
    }

    const profile = await BorrowerProfile.findOneAndUpdate(
      { userId },
      req.body,
      { new: true }
    );

    if (!profile) {
      return res.status(404).json({ message: "Borrower profile not found" });
    }

    return res.status(200).json({ profile });
  } catch (error) {
    return res.status(500).json({
      message: "Error updating borrower profile",
      error: error.message,
    });
  }
};
