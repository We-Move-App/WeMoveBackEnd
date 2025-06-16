

const express = require('express')
const { isBusOperatorAuthenticated } = require('../../../middlewares/authBusOperator')
const { getMostBookedBuses } = require('../../../controllers/bus-module/bus-analytics/bus-analytics.controllers')

const busAnalyticsRoutes = express.Router()

busAnalyticsRoutes.route('/buses').get(isBusOperatorAuthenticated, getMostBookedBuses)


module.exports = busAnalyticsRoutes