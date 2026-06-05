const logger = require('../utils/logger');

async function runJob(name, runner, options = {}) {
  const startedAt = new Date();
  logger.info('job.started', { job: name, startedAt: startedAt.toISOString() });

  try {
    const result = await runner();
    const finishedAt = new Date();
    const durationMs = finishedAt.getTime() - startedAt.getTime();
    logger.info('job.completed', {
      job: name,
      startedAt: startedAt.toISOString(),
      finishedAt: finishedAt.toISOString(),
      durationMs,
      result
    });

    return {
      name,
      status: 'completed',
      startedAt,
      finishedAt,
      durationMs,
      result
    };
  } catch (error) {
    const finishedAt = new Date();
    const durationMs = finishedAt.getTime() - startedAt.getTime();
    logger.error('job.failed', {
      job: name,
      startedAt: startedAt.toISOString(),
      finishedAt: finishedAt.toISOString(),
      durationMs,
      error
    });

    if (options.continueOnError) {
      return {
        name,
        status: 'failed',
        startedAt,
        finishedAt,
        durationMs,
        error: logger.serializeError(error)
      };
    }

    throw error;
  }
}

async function runJobSet(jobMap, requestedTasks, options = {}) {
  const names = requestedTasks?.length ? requestedTasks : Object.keys(jobMap);
  const results = {};

  for (const name of names) {
    if (!jobMap[name]) {
      results[name] = { name, status: 'skipped', reason: 'unknown_job' };
      continue;
    }

    results[name] = await runJob(name, jobMap[name], {
      continueOnError: options.continueOnError !== false
    });
  }

  return results;
}

module.exports = {
  runJob,
  runJobSet
};
