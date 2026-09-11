const autocannon = require('autocannon');

async function run() {
    const res = await fetch('http://127.0.0.1:8081/api/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ key: 'test-key-123', remember: true })
    });

    let cookie = '';
    const setCookie = res.headers.get('set-cookie');
    if (setCookie) {
        cookie = setCookie.split(';')[0];
    }

    const instance = autocannon({
        url: 'http://127.0.0.1:8081/ops',
        connections: 10,
        pipelining: 1,
        duration: 5,
        headers: {
            'cookie': cookie
        }
    });

    autocannon.track(instance, {renderProgressBar: true});

    instance.on('done', (result) => {
        console.log(`Requests/sec: ${result.requests.average}`);
    });
}
run();
