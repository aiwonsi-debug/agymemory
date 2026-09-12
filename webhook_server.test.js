jest.mock('./memory_engine.js', () => ({
  rememberItem: jest.fn(),
}), { virtual: true });

const webhookServer = require('./webhook_server.js');
const { syncToRender } = webhookServer;
const https = require('https');

jest.mock('https');

describe('syncToRender', () => {
  let originalEnv;
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should make an HTTPS POST request', () => {
    const mockReq = {
      on: jest.fn(),
      write: jest.fn(),
      end: jest.fn(),
    };
    https.request.mockReturnValue(mockReq);

    syncToRender('/test-endpoint', { foo: 'bar' });

    expect(https.request).toHaveBeenCalledTimes(1);
    expect(https.request).toHaveBeenCalledWith(
      expect.objectContaining({
        hostname: 'pscdb.onrender.com',
        path: '/test-endpoint',
        method: 'POST',
        headers: expect.objectContaining({
          'Content-Type': 'application/json',
        }),
      }),
      expect.any(Function)
    );
    expect(mockReq.write).toHaveBeenCalledWith(JSON.stringify({ foo: 'bar' }));
    expect(mockReq.end).toHaveBeenCalled();
  });

  it('should handle request errors', () => {
     const mockReq = {
      on: jest.fn((event, cb) => {
        if (event === 'error') {
          cb(new Error('Network error'));
        }
      }),
      write: jest.fn(),
      end: jest.fn(),
    };
    https.request.mockReturnValue(mockReq);

    const consoleSpy = jest.spyOn(console, 'error').mockImplementation();

    syncToRender('/test-endpoint', { foo: 'bar' });

    expect(consoleSpy).toHaveBeenCalledWith('[Render Sync Error]:', 'Network error');

    consoleSpy.mockRestore();
  });

  it('should handle JSON stringify errors', () => {
    const mockReq = {
      on: jest.fn(),
      write: jest.fn(),
      end: jest.fn(),
    };
    https.request.mockReturnValue(mockReq);

    const consoleSpy = jest.spyOn(console, 'error').mockImplementation();

    // Create a circular reference to make JSON.stringify throw
    const circularObj = {};
    circularObj.self = circularObj;

    syncToRender('/test-endpoint', circularObj);

    expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('[Render Sync Exception]:'), expect.any(String));
    expect(https.request).not.toHaveBeenCalled();

    consoleSpy.mockRestore();
  });
});
