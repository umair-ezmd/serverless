const express = require("express");
const router = express.Router();
const productController = require("../controllers/product");

// Explicit, clear routes
router.post("/create", productController.createProduct);
router.get("/all", productController.getAllProducts);
router.get("/detail/:id", productController.getProductById);
router.put("/update/:id", productController.updateProduct);
router.delete("/delete/:id", productController.deleteProduct);

module.exports = router;
