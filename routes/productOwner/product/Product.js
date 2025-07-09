const express = require("express");
const {
  VerifyProductOwnerJWTToken,
  Errordisplay,
} = require("../../../utils/Auth.utils");
const BalanceModel = require("../../../models/wallet/Balance.model");
const { uploadimg } = require("../../../utils/Cloudinary.utils");
const { v4: uuidv4 } = require("uuid");
const ProductModel = require("../../../models/products/Product.model");
const router = express.Router();

// Create Product
router.post("/add", VerifyProductOwnerJWTToken, async (req, res) => {
  try {
    const { name, description, currency, affiliateCommission, maxClicks } =
      req.body;

    const image = req.files?.image;

    // Check if user is product owner
    if (req.user.type !== "Product Owner") {
      return res.status(403).json({
        Access: true,
        Error: "Only product owners can create products",
      });
    }

    // Validate required fields
    if (!name || !description || !affiliateCommission || !maxClicks) {
      return res
        .status(400)
        .json({ Access: true, Error: "All fields are required" });
    }

    // Calculate expected cost
    const expectedCost = parseFloat(affiliateCommission) * parseInt(maxClicks);

    const userBalance = await BalanceModel.findOne({
      UserID: req.user._id,
      TypeOf: "Product Owner",
    });

    // Check if user has sufficient balance
    if (userBalance.Balance < expectedCost) {
      return res.status(400).json({
        Access: true,
        Error: "Insufficient balance",
        requiredAmount: expectedCost,
        currentBalance: userBalance.Balance,
        deficit: expectedCost - userBalance.Balance,
      });
    }

    // Upload image to Cloudinary if provided
    let uploadedImage;
    if (image) {
      uploadedImage = await uploadimg(image, process.env.Images);

      if (uploadedImage.error) {
        return res
          .status(500)
          .json({ Access: true, Error: "Error Occured uploading image" });
      }
    }

    // Generate unique product ID
    const uniqueProductId = uuidv4();

    // Create product
    const product = new ProductModel({
      name,
      description,
      imageUrl: uploadedImage.url,
      imagePublicId: uploadedImage.publicID,
      currency: currency,
      affiliateCommission: parseFloat(affiliateCommission),
      maxClicks: parseInt(maxClicks),
      expectedCost,
      productOwner: req.user._id,
      uniqueProductId,
    });

    await product.save();

    await BalanceModel.findOneAndUpdate(
      {
        UserID: req.user._id,
        TypeOf: "Product Owner",
      },
      { $inc: { Balance: -expectedCost, Reserved: expectedCost } }
    );

    res.status(200).json({
      Access: true,
      Message: "Product created successfully",
      Data: {
        id: product._id,
        name: product.name,
        description: product.description,
        image: product.image,
        currency: product.currency,
        affiliateCommission: product.affiliateCommission,
        maxClicks: product.maxClicks,
        expectedCost: product.expectedCost,
        uniqueProductId: product.uniqueProductId,
        isActive: product.isActive,
      },
      Error: false,
    });
  } catch (error) {
    res.status(400).json({ Access: true, Error: Errordisplay(error).msg });
  }
});

module.exports = router;
