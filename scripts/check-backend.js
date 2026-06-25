const http = require('http');

function checkPort(port) {
  return new Promise((resolve) => {
    const options = {
      hostname: 'localhost',
      port,
      path: '/api/health',
      method: 'GET',
      timeout: 2000,
    };
    const req = http.request(options, (res) => {
      res.on('data', () => {});
      res.on('end', () => resolve({ running: true, status: res.statusCode }));
    });
    req.on('error', () => resolve({ running: false }));
    req.on('timeout', () => {
      req.destroy();
      resolve({ running: false });
    });
    req.end();
  });
}

async function main() {
  const r = await checkPort(3000);
  if (r.running) {
    console.log('Backend is running on port 3000');
  } else {
    console.log('Backend is NOT running on port 3000');
    process.exit(1);
  }
}

main();
