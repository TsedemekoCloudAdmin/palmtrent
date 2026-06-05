require('dotenv').config();

const mongoose = require('mongoose');
const connectDB = require('../config/database');
const documentExpiryService = require('../services/documentExpiryService');
const escrowService = require('../services/escrowService');
const shipmentMaintenanceService = require('../services/shipmentMaintenanceService');
const corporateReportService = require('../services/corporateReportService');
const ecocashOpenApiService = require('../services/ecocashOpenApiService');
const paymentReconciliationService = require('../services/paymentReconciliationService');
const { runJobSet } = require('../services/jobRunnerService');

const requestedTasks = process.argv
  .slice(2)
  .map(task => task.trim().toLowerCase())
  .filter(Boolean);
const defaultTasks = ['escrow', 'payouts', 'documents', 'shipments', 'corporate-reports', 'payments', 'ecocash-agent'];

const runMaintenanceJobs = async () => {
  if (!process.env.MONGODB_URI) {
    throw new Error('MONGODB_URI is required to run maintenance jobs');
  }

  await connectDB();

  const jobMap = {
    escrow: () => escrowService.processScheduledReleases(),
    payouts: () => escrowService.backfillReleasedEscrowPayouts(),
    documents: () => documentExpiryService.checkAllDocuments(),
    shipments: () => shipmentMaintenanceService.backfillShipmentBookingLinks(),
    'corporate-reports': () => corporateReportService.processDueSchedules(),
    payments: () => paymentReconciliationService.reconcileAllPendingPayments(),
    'openapi-payments': () => paymentReconciliationService.reconcilePendingOpenApiPayments(),
    'ecocash-agent': () => ecocashOpenApiService.reconcilePendingCashAgentPayments()
  };

  const taskList = requestedTasks.length > 0 ? requestedTasks : defaultTasks;
  const results = await runJobSet(jobMap, taskList, { continueOnError: true });

  console.log(JSON.stringify({
    success: true,
    tasks: taskList,
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
