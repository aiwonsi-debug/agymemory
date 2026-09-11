const { describe, it, mock } = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const quotaTracker = require('./ai_quota_tracker.js');

describe('ai_quota_tracker', () => {
    describe('loadQuotaData', () => {
        it('should handle fs.readFileSync error gracefully', () => {
            const existsSyncMock = mock.method(fs, 'existsSync', () => true);
            const readFileSyncMock = mock.method(fs, 'readFileSync', () => {
                throw new Error('Simulated read error');
            });
            const consoleErrorMock = mock.method(console, 'error', () => {});

            const result = quotaTracker.loadQuotaData();

            assert.strictEqual(consoleErrorMock.mock.calls.length, 1);
            assert.strictEqual(consoleErrorMock.mock.calls[0].arguments[0], '[QuotaTracker] Error reading quota file:');
            assert.strictEqual(consoleErrorMock.mock.calls[0].arguments[1], 'Simulated read error');

            // Check that it returned DEFAULT_DATA (or a structure matching it)
            assert.ok(result);
            assert.ok(result.groq);
            assert.ok(result.agy);
            assert.ok(result.glm);
            assert.ok(result.okmd);

            existsSyncMock.mock.restore();
            readFileSyncMock.mock.restore();
            consoleErrorMock.mock.restore();
        });

        it('should handle JSON.parse error gracefully', () => {
            const existsSyncMock = mock.method(fs, 'existsSync', () => true);
            const readFileSyncMock = mock.method(fs, 'readFileSync', () => 'invalid json');
            const consoleErrorMock = mock.method(console, 'error', () => {});

            const result = quotaTracker.loadQuotaData();

            assert.strictEqual(consoleErrorMock.mock.calls.length, 1);
            assert.strictEqual(consoleErrorMock.mock.calls[0].arguments[0], '[QuotaTracker] Error reading quota file:');

            assert.ok(result);
            assert.ok(result.groq);

            existsSyncMock.mock.restore();
            readFileSyncMock.mock.restore();
            consoleErrorMock.mock.restore();
        });
    });
});
