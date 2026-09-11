const fs = require('fs');
const test = require('node:test');
const assert = require('node:assert');

// It's important to require the tracker module AFTER we can mock fs methods
// Or if we require it first, we must mock the methods inside the tests.
const tracker = require('./ai_quota_tracker');

test('formatUsageForTelegram - with full custom data', (t) => {
  t.mock.method(fs, 'existsSync', () => true);
  t.mock.method(fs, 'readFileSync', () => {
    return JSON.stringify({
      okmd: {
        model: 'custom-deepseek',
        provider: 'CustomProvider',
        daily_remaining_tokens: 150000,
        daily_quota_tokens: 200000,
        total_requests: 123,
        total_tokens: 456,
        status: 'ONLINE'
      },
      agy: {
        account: 'test@example.com',
        gemini: {
          weekly_remaining_pct: 50.5,
          weekly_refresh: '10h',
          five_hour_remaining_pct: 20.2,
          five_hour_refresh: '1h'
        },
        claude_gpt: {
          weekly_remaining_pct: 10.1,
          weekly_refresh: '5h'
        },
        total_prompts: 42
      },
      groq: {
        model: 'custom-qwen',
        total_requests: 999,
        rate_limit: {
          limit_tokens: 10000,
          remaining_tokens: 2500
        }
      }
    });
  });

  const result = tracker.formatUsageForTelegram();

  // Verify OKMD section
  assert.ok(result.includes('custom-deepseek'), 'Should contain custom okmd model');
  assert.ok(result.includes('CustomProvider'), 'Should contain custom okmd provider');
  assert.ok(result.includes('150,000 / 200,000'), 'Should contain formatted okmd tokens');
  assert.ok(result.includes('(75%)'), 'Should contain okmd token percentage');
  assert.ok(result.includes('123 ครั้ง'), 'Should contain okmd total requests');

  // Verify AGY section
  assert.ok(result.includes('test@example.com'), 'Should contain agy account');
  assert.ok(result.includes('50.5%'), 'Should contain gemini weekly pct');
  assert.ok(result.includes('20.2%'), 'Should contain gemini 5h pct');
  assert.ok(result.includes('10.1%'), 'Should contain claude weekly pct');
  assert.ok(result.includes('42 ครั้ง'), 'Should contain agy total prompts');

  // Verify Groq section
  assert.ok(result.includes('custom-qwen'), 'Should contain groq model');
  assert.ok(result.includes('2,500 / 10,000'), 'Should contain groq tokens');
  assert.ok(result.includes('(25%)'), 'Should contain groq token percentage');
  assert.ok(result.includes('999 ครั้ง'), 'Should contain groq requests');
});

test('formatUsageForTelegram - with no data file (uses defaults)', (t) => {
  t.mock.method(fs, 'existsSync', () => false);

  const result = tracker.formatUsageForTelegram();

  // Verify it uses defaults
  assert.ok(result.includes('deepseek-v4-pro'), 'Should contain default okmd model');
  assert.ok(result.includes('aiwonsi@gmail.com'), 'Should contain default agy account');
  assert.ok(result.includes('qwen/qwen3.8-27b'), 'Should contain default groq model');
  assert.ok(result.includes('174,229 / 180,000'), 'Should contain default okmd tokens');
});

test('formatUsageForTelegram - with invalid JSON file', (t) => {
  t.mock.method(fs, 'existsSync', () => true);
  t.mock.method(fs, 'readFileSync', () => 'this is not valid json');

  // Suppress console.error for this test
  t.mock.method(console, 'error', () => {});

  const result = tracker.formatUsageForTelegram();

  // Should fall back to default data silently (except for the console.error we mocked out)
  assert.ok(result.includes('deepseek-v4-pro'), 'Should contain default okmd model');
  assert.ok(result.includes('qwen/qwen3.8-27b'), 'Should contain default groq model');
});

test('formatUsageForTelegram - with partial data (handling missing fields gracefully)', (t) => {
  t.mock.method(fs, 'existsSync', () => true);
  t.mock.method(fs, 'readFileSync', () => {
    return JSON.stringify({
      okmd: {
        // Missing tokens and requests
      },
      agy: {
        // Missing gemini and claude objects entirely
      },
      groq: {
        // Missing rate limit entirely
      }
    });
  });

  const result = tracker.formatUsageForTelegram();

  // OKMD defaults when missing
  assert.ok(result.includes('180,000 / 180,000'), 'Should fallback to 180k tokens for okmd');
  assert.ok(result.includes('(100%)'), 'Should fallback to 100% for okmd');

  // AGY defaults when missing (note: loadQuotaData merges missing agy defaults deeply for agy.gemini)
  assert.ok(result.includes('92.16%'), 'Should fallback to 92.16% for gemini weekly pct');
  assert.ok(result.includes('70.22%'), 'Should fallback to 70.22% for gemini 5h pct');
  assert.ok(result.includes('0%'), 'Should fallback to 0% for claude');

  // Groq defaults when missing
  assert.ok(result.includes('0 / 8,000'), 'Should handle missing groq rate limits');
  assert.ok(result.includes('(100%)'), 'Should handle missing groq rate limits pct');
});
