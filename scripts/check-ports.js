const http = require('http');

function checkPort(port) {
  return new Promise((resolve) => {
    const options = { hostname: 'localhost', port, path: '/', method: 'HEAD' };
    const req = http.request(options, (res) => {
      resolve({ port, running: true, status: res.statusCode });
    });
    req.on('error', () => {
      resolve({ port, running: false });
    });
    req.end();
  });
}

async function main() {
  const ports = [3000, 5173, 5174, 5175, 5176];
  for (const port of ports) {
    const r = await checkPort(port);
    console.log(`Port ${port}: ${r.running ? 'RUNNING' : 'NOT RUNNING'}${r.status ? ' (HTTP ' + r.status + ')' : ''}`);
  }

  // Check if Vite proxy to backend works
  console.log('\n=== Testing Vite proxy ===');
  try {
    const proxyPort = 5175;
    const options = {
      hostname: 'localhost',
      port: proxyPort,
      path: '/api/health',
      method: 'GET',
    };
    const req = http.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => { data += chunk; });
      res.on('end', () => {
        console.log(`/api/health via port ${proxyPort}: HTTP ${res.statusCode}`);
        console.log(`Body: ${data}`);
      });
    });
    req.on('error', (e) => {
      console.log(`Error: ${e.message}`);
    });
    req.end();
  } catch (e) {
    console.log(`Error: ${e.message}`);
  }
}

main();
