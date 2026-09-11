jest.mock('./memory_engine.js', () => ({
  rememberItem: jest.fn(),
}), { virtual: true });

const { escapeHtml } = require('./webhook_server.js');

describe('escapeHtml', () => {
    it('escapes special characters correctly', () => {
        expect(escapeHtml("& < > \" '")).toBe('&amp; &lt; &gt; &quot; &#039;');
        expect(escapeHtml('<script>alert("XSS & CSRF")</script>')).toBe('&lt;script&gt;alert(&quot;XSS &amp; CSRF&quot;)&lt;/script&gt;');
    });

    it('returns the same string if no special characters exist', () => {
        expect(escapeHtml('Hello World!')).toBe('Hello World!');
        expect(escapeHtml('12345')).toBe('12345');
    });

    it('returns empty string for empty string input', () => {
        expect(escapeHtml('')).toBe('');
    });

    it('returns empty string for non-string or falsy values', () => {
        expect(escapeHtml(null)).toBe('');
        expect(escapeHtml(undefined)).toBe('');
        expect(escapeHtml(123)).toBe('');
        expect(escapeHtml({})).toBe('');
        expect(escapeHtml([])).toBe('');
        expect(escapeHtml(true)).toBe('');
        expect(escapeHtml(false)).toBe('');
    });
});
