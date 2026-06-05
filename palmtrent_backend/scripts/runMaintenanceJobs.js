require('dotenv').config();

const mongoose = require('mongoose');
const connectDB = require('../config/database');
const documentExpiryService = require('../services/documentExpiryService');
const escrowService = require('../services/escrowService');
const shipmentMaintenanceService = require('../services/shipmentMaintenanceService');
const corporateReportService = require('../services/corporateReportService');
const ecocashOpenApiService = require('../services/ecocashOpenApiService');

const requestedTasks = process.argv
  .slice(2)
  .map(task => task.trim().toLowerCase())
  .filter(Boolean);
const tasks = new Set(requestedTasks.length > 0 ? requestedTasks : ['escrow', 'payouts', 'documents', 'shipments', 'corporate-reports', 'ecocash-agent']);

const runMaintenanceJobs = async () => {
  if (!process.env.MONGODB_URI) {
    throw new Error('MONGODB_URI is required to run maintenance jobs');
  }

  await connectDB();

  const results = {};
  if (tasks.has('escrow')) {
    results.escrow = await escrowService.processScheduledReleases();
  }
  if (tasks.has('payouts')) {
    results.payouts = await escrowService.backfillReleasedEscrowPayouts();
  }
  if (tasks.has('documents')) {
    results.documents = await documentExpiryService.checkAllDocuments();
  }
  if (tasks.has('shipments')) {
    results.shipments = await shipmentMaintenanceService.backfillShipmentBookingLinks();
  }
  if (tasks.has('corporate-reports')) {
    results.corporateReports = await corporateReportService.processDueSchedules();
  }
  if (tasks.has('ecocash-agent')) {
    results.ecocashAgent = await ecocashOpenApiService.reconcilePendingCashAgentPayments();
  }

  console.log(JSON.stringify({
    success: true,
    tasks: [...tasks],
    results
  }, null, 2));
};

runMaintenanceJobs()
  .catch((error) => {
    console.error('Maintenance jobs failed:', error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await mongoose.disconnect();
  });
