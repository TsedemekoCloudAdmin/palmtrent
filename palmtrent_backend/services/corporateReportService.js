const Booking = require('../models/Booking');
const CorporateAccount = require('../models/CorporateAccount');
const CorporateReportSchedule = require('../models/CorporateReportSchedule');
const Invoice = require('../models/Invoice');
const notificationService = require('./notificationService');

const csvEscape = (value) => `"${String(value ?? '').replace(/"/g, '""')}"`;

const toCsv = (rows) => {
  const data = rows.length ? rows : [{ message: 'No records available' }];
  const headers = Object.keys(data[0]);
  return [
    headers.join(','),
    ...data.map(row => headers.map(header => csvEscape(row[header])).join(','))
  ].join('\n');
};

const nextRunFrom = (date, frequency) => {
  const next = new Date(date || Date.now());
  if (frequency === 'weekly') {
    next.setDate(next.getDate() + 7);
  } else {
    next.setMonth(next.getMonth() + 1);
  }
  next.setHours(8, 0, 0, 0);
  return next;
};

class CorporateReportService {
  async buildRows(schedule) {
    const corporateAccountId = schedule.corporateAccount?._id || schedule.corporateAccount;

    if (schedule.reportType === 'bookings') {
      const bookings = await Booking.find({ corporateAccount: corporateAccountId })
        .populate('shipper', 'fullName email')
        .populate('transporter', 'fullName email')
        .sort('-createdAt')
        .limit(1000);

      return bookings.map(booking => ({
        bookingReference: booking.bookingReference || booking.bookingId || booking._id,
        status: booking.status,
        shipper: booking.shipper?.fullName || booking.shipper?.email || '',
        transporter: booking.transporter?.fullName || booking.transporter?.email || '',
        pickup: booking.route?.pickup?.address || '',
        delivery: booking.route?.delivery?.address || '',
        amount: booking.pricing?.totals?.total || booking.pricing?.total || booking.totalAmount || 0,
        createdAt: booking.createdAt?.toISOString?.() || ''
      }));
    }

    if (schedule.reportType === 'spending' || schedule.reportType === 'invoices') {
      const invoices = await Invoice.find({ corporateAccount: corporateAccountId })
        .sort('-createdAt')
        .limit(1000);

      return invoices.map(invoice => ({
        invoiceNumber: invoice.invoiceNumber || invoice._id,
        status: invoice.status,
        subtotal: invoice.subtotal || 0,
        taxAmount: invoice.taxAmount || 0,
        total: invoice.total || invoice.amount || 0,
        dueDate: invoice.dueDate?.toISOString?.() || '',
        createdAt: invoice.createdAt?.toISOString?.() || ''
      }));
    }

    if (schedule.reportType === 'team') {
      const account = await CorporateAccount.findById(corporateAccountId)
        .populate('settings.allowedUsers.user', 'fullName email phone status userType');

      return (account?.settings?.allowedUsers || []).map(member => ({
        name: member.user?.fullName || '',
        email: member.user?.email || '',
        phone: member.user?.phone || '',
        role: member.role,
        status: member.user?.status || ''
      }));
    }

    const bookings = await Booking.find({ corporateAccount: corporateAccountId })
      .sort('-createdAt')
      .limit(1000);
    const routeStats = new Map();

    bookings.forEach((booking) => {
      const route = `${booking.route?.pickup?.address || 'N/A'} -> ${booking.route?.delivery?.address || 'N/A'}`;
      const current = routeStats.get(route) || { route, bookings: 0, spend: 0 };
      current.bookings += 1;
      current.spend += Number(booking.pricing?.totals?.total || booking.pricing?.total || booking.totalAmount || 0);
      routeStats.set(route, current);
    });

    return [...routeStats.values()];
  }

  async sendScheduledReport(schedule) {
    const populated = await CorporateReportSchedule.findById(schedule._id)
      .populate('corporateAccount', 'companyName contactPerson billingContact');
    const recipients = (populated.recipients || []).filter(Boolean);

    if (!recipients.length) {
      throw new Error('Scheduled report has no recipients');
    }

    const rows = await this.buildRows(populated);
    const csv = toCsv(rows);
    const filename = `${populated.reportName.toLowerCase().replace(/[^a-z0-9]+/g, '-') || 'corporate-report'}.csv`;

    await notificationService.sendEmail({
      to: recipients.join(','),
      subject: `Palmtrent scheduled report: ${populated.reportName}`,
      text: `Attached is your ${populated.frequency} ${populated.reportName} report for ${populated.corporateAccount?.companyName || 'your corporate account'}.`,
      html: `
        <div style="font-family: Arial, sans-serif; color: #1f2937;">
          <h2>Palmtrent scheduled report</h2>
          <p>Attached is your ${populated.frequency} ${populated.reportName} report.</p>
          <p>Rows included: ${rows.length}</p>
        </div>
      `,
      attachments: [{
        filename,
        content: Buffer.from(csv, 'utf8'),
        contentType: 'text/csv'
      }]
    });

    populated.lastRunAt = new Date();
    populated.nextRunAt = nextRunFrom(populated.lastRunAt, populated.frequency);
    populated.lastError = undefined;
    await populated.save();

    return {
      scheduleId: populated._id,
      reportName: populated.reportName,
      recipients,
      rowCount: rows.length,
      nextRunAt: populated.nextRunAt
    };
  }

  async processDueSchedules(now = new Date()) {
    const due = await CorporateReportSchedule.find({
      status: 'active',
      nextRunAt: { $lte: now }
    }).limit(50);

    const results = [];
    for (const schedule of due) {
      try {
        results.push({ success: true, data: await this.sendScheduledReport(schedule) });
      } catch (error) {
        schedule.lastError = error.message;
        schedule.nextRunAt = nextRunFrom(now, schedule.frequency);
        await schedule.save();
        results.push({
          success: false,
          scheduleId: schedule._id,
          reportName: schedule.reportName,
          error: error.message,
          nextRunAt: schedule.nextRunAt
        });
      }
    }

    return {
      processed: due.length,
      sent: results.filter(result => result.success).length,
      failed: results.filter(result => !result.success).length,
      results
    };
  }
}

module.exports = new CorporateReportService();
