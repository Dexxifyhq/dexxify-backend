const env = require('dotenv').config({ path: '.env.local' });
const https = require('https');

class BreetMCPClient {
  constructor(appId, appSecret, environment = 'development') {
    this.appId = appId;
    this.appSecret = appSecret;
    this.environment = environment;
    this.serverUrl = 'https://docs.breet.io/mcp';
  }

  async searchDocs(query) {
    const requestData = JSON.stringify({
      jsonrpc: '2.0',
      id: Date.now(),
      method: 'tools/call',
      params: {
        name: 'search_breet_docs',
        arguments: {
          query: query,
        },
      },
    });

    return new Promise((resolve, reject) => {
      const options = {
        hostname: 'docs.breet.io',
        port: 443,
        path: '/mcp',
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json, text/event-stream',
          'Content-Length': Buffer.byteLength(requestData),
          'x-app-id': this.appId,
          'x-app-secret': this.appSecret,
          'X-Breet-Env': this.environment,
        },
      };

      const req = https.request(options, (res) => {
        let data = '';

        res.on('data', (chunk) => {
          data += chunk;
        });

        res.on('end', () => {
          try {
            // Handle SSE format
            if (data.includes('event: message') && data.includes('data: ')) {
              const dataMatch = data.match(/data: (.+)/);
              if (dataMatch) {
                const jsonData = dataMatch[1];
                const result = JSON.parse(jsonData);
                console.log(
                  '✅ Search Results (SSE):',
                  JSON.stringify(result, null, 2),
                );
                resolve(result);
                return;
              }
            }

            // Handle regular JSON
            const result = JSON.parse(data);
            console.log('✅ Search Results:', JSON.stringify(result, null, 2));
            resolve(result);
          } catch (error) {
            console.error('❌ Failed to parse response:', error);
            console.error('Raw response:', data);
            reject(error);
          }
        });
      });

      req.on('error', (error) => {
        console.error('❌ Request error:', error);
        reject(error);
      });

      req.write(requestData);
      req.end();
    });
  }

  async getServerInfo() {
    return new Promise((resolve, reject) => {
      const options = {
        hostname: 'docs.breet.io',
        port: 443,
        path: '/mcp',
        method: 'GET',
      };

      const req = https.request(options, (res) => {
        let data = '';

        res.on('data', (chunk) => {
          data += chunk;
        });

        res.on('end', () => {
          try {
            const result = JSON.parse(data);
            console.log('✅ Server Info:', JSON.stringify(result, null, 2));
            resolve(result);
          } catch (error) {
            console.error('❌ Failed to parse server info:', error);
            reject(error);
          }
        });
      });

      req.on('error', (error) => {
        console.error('❌ Server info error:', error);
        reject(error);
      });

      req.end();
    });
  }
}

async function main() {
  const { BREET_APP_ID, BREET_SECRET_KEY } = env.parsed;
  // console.log(env.parsed);
  // console.log(BREET_APP_ID);

  const APP_ID = BREET_APP_ID;
  const APP_SECRET = BREET_SECRET_KEY;

  if (!APP_ID || !APP_SECRET) {
    console.log(
      '❌ Please set BREET_APP_ID and BREET_APP_SECRET environment variables',
    );
    return;
  }

  const client = new BreetMCPClient(APP_ID, APP_SECRET);

  try {
    console.log('🔍 Testing Breet MCP Server Connection...\n');

    // Test server info
    await client.getServerInfo();

    console.log('\n🔍 Searching for "how to create payment"...\n');

    // Search documentation
    await client.searchDocs('how to create payment');

    console.log('\n🔍 Searching for "API authentication"...\n');

    // Search another query
    await client.searchDocs('API authentication');
  } catch (error) {
    console.error('❌ Error:', error.message);
  }
}

if (require.main === module) {
  main();
}

module.exports = BreetMCPClient;
