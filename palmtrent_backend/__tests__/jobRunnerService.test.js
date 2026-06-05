jest.mock('../utils/logger', () => ({
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
  serializeError: jest.fn((error) => ({ message: error.message }))
}));

const logger = require('../utils/logger');
const { runJob, runJobSet } = require('../services/jobRunnerService');

describe('jobRunnerService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('records completed job metadata', async () => {
    const result = await runJob('sample', jest.fn().mockResolvedValue({ ok: true }));

    expect(result).toEqual(expect.objectContaining({
      name: 'sample',
      status: 'completed',
      result: { ok: true }
    }));
    expect(logger.info).toHaveBeenCalledWith('job.started', expect.objectContaining({ job: 'sample' }));
    expect(logger.info).toHaveBeenCalledWith('job.completed', expect.objectContaining({ job: 'sample' }));
  });

  test('continues failed jobs when configured', async () => {
    const result = await runJobSet({
      first: jest.fn().mockRejectedValue(new Error('boom')),
      second: jest.fn().mockResolvedValue({ ok: true })
    }, ['first', 'second'], { continueOnError: true });

    expect(result.first.status).toBe('failed');
    expect(result.second.status).toBe('completed');
    expect(logger.error).toHaveBeenCalledWith('job.failed', expect.objectContaining({ job: 'first' }));
  });
});
