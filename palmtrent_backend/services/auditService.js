const AuditLog = require('../models/AuditLog');

async function recordAudit({
  actor,
  action,
  entityType,
  entityId,
  entityRef,
  before,
  after,
  metadata,
  req
}) {
  try {
    return await AuditLog.create({
      actor: actor?._id || actor?.id || actor,
      actorType: actor?.userType || 'system',
      action,
      entityType,
      entityId,
      entityRef,
      before,
      after,
      metadata,
      ipAddress: req?.ip,
      userAgent: req?.get?.('user-agent')
    });
  } catch (error) {
    console.error('Audit log write failed:', error);
    return null;
  }
}

module.exports = {
  recordAudit
};
