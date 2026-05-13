const SafetyReport = require('../models/SafetyReport');
const Shipment = require('../models/Shipment');
const { recordAudit } = require('../services/auditService');
const notificationService = require('../services/notificationService');

function ownsShipment(shipment, userId, userType) {
  return userType === 'admin' ||
    shipment?.transporter?.toString() === userId ||
    shipment?.shipper?.toString() === userId;
}

exports.submitPreTripChecklist = async (req, res) => {
  try {
    const { shipmentId, vehicleId, driverId, checklist = [], notes, location } = req.body;
    const shipment = shipmentId ? await Shipment.findById(shipmentId) : null;
    if (shipmentId && !ownsShipment(shipment, req.user.id, req.user.userType)) {
      return res.status(403).json({ success: false, message: 'Not authorized for this shipment' });
    }

    const failedItems = checklist.filter(item => item.passed === false);
    const report = await SafetyReport.create({
      reporter: req.user.id,
      shipment: shipmentId,
      booking: shipment?.booking,
      vehicle: vehicleId || shipment?.vehicle,
      driver: driverId,
      type: 'pre_trip_checklist',
      severity: failedItems.length ? 'high' : 'low',
      status: failedItems.length ? 'open' : 'resolved',
      checklist,
      description: notes,
      location
    });

    if (failedItems.length && shipment) {
      shipment.status = 'incident';
      await shipment.save();
    }

    await recordAudit({
      actor: req.user,
      action: 'safety.pre_trip_submitted',
      entityType: 'SafetyReport',
      entityId: report._id,
      after: { status: report.status, severity: report.severity, failedItems: failedItems.length },
      req
    });

    res.status(201).json({ success: true, message: 'Pre-trip checklist submitted', data: report });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Failed to submit checklist', error: error.message });
  }
};

exports.reportIncident = async (req, res) => {
  try {
    const { shipmentId, bookingId, vehicleId, driverId, incidentType, severity = 'high', description, location, attachments = [] } = req.body;
    const shipment = shipmentId ? await Shipment.findById(shipmentId) : null;
    if (shipmentId && !ownsShipment(shipment, req.user.id, req.user.userType)) {
      return res.status(403).json({ success: false, message: 'Not authorized for this shipment' });
    }

    const report = await SafetyReport.create({
      reporter: req.user.id,
      shipment: shipmentId,
      booking: bookingId || shipment?.booking,
      vehicle: vehicleId || shipment?.vehicle,
      driver: driverId,
      type: 'incident',
      severity,
      description: incidentType ? `${incidentType}: ${description || ''}` : description,
      location,
      attachments
    });

    if (shipment) {
      shipment.status = 'incident';
      await shipment.save();
    }

    await notificationService.notifyRole('admin', 'emergency_alert', 'Safety Incident Reported', description || 'A safety incident was reported.', {
      reportId: report._id.toString(),
      shipmentId
    });

    await recordAudit({
      actor: req.user,
      action: 'safety.incident_reported',
      entityType: 'SafetyReport',
      entityId: report._id,
      after: { severity, shipmentId },
      req
    });

    res.status(201).json({ success: true, message: 'Incident reported', data: report });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Failed to report incident', error: error.message });
  }
};

exports.reportFatigue = async (req, res) => {
  try {
    const { shipmentId, hoursDriving, lastRestAt, location } = req.body;
    const restRequired = Number(hoursDriving || 0) >= 8;
    const report = await SafetyReport.create({
      reporter: req.user.id,
      shipment: shipmentId,
      type: 'fatigue',
      severity: restRequired ? 'high' : 'medium',
      fatigue: { hoursDriving, lastRestAt: lastRestAt ? new Date(lastRestAt) : undefined, restRequired },
      location,
      description: restRequired ? 'Driver rest required' : 'Fatigue check submitted'
    });

    res.status(201).json({ success: true, message: 'Fatigue report submitted', data: report });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Failed to submit fatigue report', error: error.message });
  }
};

exports.reportSpeedAlert = async (req, res) => {
  try {
    const { shipmentId, speed, speedLimit, location } = req.body;
    const severity = Number(speed) > Number(speedLimit || 0) + 20 ? 'high' : 'medium';
    const report = await SafetyReport.create({
      reporter: req.user.id,
      shipment: shipmentId,
      type: 'speed_alert',
      severity,
      speed,
      location,
      description: `Speed ${speed} exceeded limit ${speedLimit}`
    });

    res.status(201).json({ success: true, message: 'Speed alert recorded', data: report });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Failed to record speed alert', error: error.message });
  }
};

exports.getSafetyReports = async (req, res) => {
  try {
    const { status, type, page = 1, limit = 20 } = req.query;
    const query = req.user.userType === 'admin' ? {} : { reporter: req.user.id };
    if (status) query.status = status;
    if (type) query.type = type;

    const reports = await SafetyReport.find(query)
      .populate('shipment', 'bookingReference status')
      .populate('vehicle', 'registrationNumber')
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(parseInt(limit));
    const total = await SafetyReport.countDocuments(query);

    res.json({ success: true, data: reports, pagination: { page: parseInt(page), limit: parseInt(limit), total, pages: Math.ceil(total / limit) } });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Failed to fetch safety reports', error: error.message });
  }
};

exports.resolveSafetyReport = async (req, res) => {
  try {
    if (req.user.userType !== 'admin') {
      return res.status(403).json({ success: false, message: 'Admin access required' });
    }
    const report = await SafetyReport.findByIdAndUpdate(req.params.id, {
      status: req.body.status || 'resolved',
      resolution: {
        notes: req.body.notes,
        resolvedBy: req.user.id,
        resolvedAt: new Date()
      }
    }, { new: true });

    if (!report) return res.status(404).json({ success: false, message: 'Safety report not found' });
    res.json({ success: true, message: 'Safety report updated', data: report });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Failed to update safety report', error: error.message });
  }
};
