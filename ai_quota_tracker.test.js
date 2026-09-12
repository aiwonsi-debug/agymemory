const fs = require('fs');
const tracker = require('./ai_quota_tracker');

describe('ai_quota_tracker', () => {
  beforeEach(() => {
    jest.resetAllMocks();
  });

  test('formatUsageForTelegram - with full custom data', () => {
    jest.spyOn(fs, 'existsSync').mockReturnValue(true);
    jest.spyOn(fs, 'readFileSync').mockReturnValue(JSON.stringify({
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
    }));

    const result = tracker.formatUsageForTelegram();

    expect(result).toContain('custom-deepseek');
    expect(result).toContain('CustomProvider');
    expect(result).toContain('150,000 / 200,000');
    expect(result).toContain('(75%)');
    expect(result).toContain('123 ครั้ง');

    expect(result).toContain('test@example.com');
    expect(result).toContain('50.5%');
    expect(result).toContain('20.2%');
    expect(result).toContain('10.1%');
    expect(result).toContain('42 ครั้ง');

    expect(result).toContain('custom-qwen');
    expect(result).toContain('2,500 / 10,000');
    expect(result).toContain('(25%)');
    expect(result).toContain('999 ครั้ง');
  });

  test('formatUsageForTelegram - with no data file (uses defaults)', () => {
    jest.spyOn(fs, 'existsSync').mockReturnValue(false);

    const result = tracker.formatUsageForTelegram();

    expect(result).toContain('deepseek-v4-pro');
    expect(result).toContain('aiwonsi@gmail.com');
    expect(result).toContain('qwen/qwen3.8-27b');
    expect(result).toContain('174,229 / 180,000');
  });

  test('formatUsageForTelegram - with invalid JSON file', () => {
    jest.spyOn(fs, 'existsSync').mockReturnValue(true);
    jest.spyOn(fs, 'readFileSync').mockReturnValue('this is not valid json');
    jest.spyOn(console, 'error').mockImplementation(() => {});

    const result = tracker.formatUsageForTelegram();

    expect(result).toContain('deepseek-v4-pro');
    expect(result).toContain('qwen/qwen3.8-27b');
  });

  test('formatUsageForTelegram - with partial data (handling missing fields gracefully)', () => {
    jest.spyOn(fs, 'existsSync').mockReturnValue(true);
    jest.spyOn(fs, 'readFileSync').mockReturnValue(JSON.stringify({
      okmd: {},
      agy: {},
      groq: {}
    }));

    const result = tracker.formatUsageForTelegram();

    expect(result).toContain('180,000 / 180,000');
    expect(result).toContain('(100%)');
    expect(result).toContain('92.16%');
    expect(result).toContain('70.22%');
    expect(result).toContain('0%');
    expect(result).toContain('0 / 8,000');
    expect(result).toContain('(100%)');
  });
});
