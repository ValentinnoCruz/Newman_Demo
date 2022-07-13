const express = require("express");
const route = express.Router();
const AdminController = require("../controllers/adminController");
route.get("/gameserver/jobs/adjuststandby", AdminController.adjustStandby);
route.get("/jobs/collectmetrics", AdminController.collectMetrics);

module.exports = route;
