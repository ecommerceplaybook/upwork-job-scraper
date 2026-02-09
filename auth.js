require('dotenv').config();
const http = require('http');
const { exec } = require('child_process');
const axios = require('axios');
const fs = require('fs');
const path = require('path');

const CLIENT_ID = process.env.UPWORK_API_KEY;
const CLIENT_SECRET = process.env.UPWORK_API_SECRET;
const REDIRECT_URI = process.env.UPWORK_REDIRECT_URI || 'http://localhost:3000/callback';
const PORT = 3000;

// Upwork OAuth2 endpoints
const AUTHORIZE_URL = 'https://www.upwork.com/ab/account-security/oauth2/authorize';
const TOKEN_URL = 'https://www.upwork.com/api/v3/oauth2/token';

/**
 * Update .env file with access and refresh tokens
 */
function updateEnvFile(accessToken, refreshToken) {
  const envPath = path.join(__dirname, '.env');
  let envContent = fs.readFileSync(envPath, 'utf8');
  
  // Update or add access token
  if (envContent.includes('UPWORK_ACCESS_TOKEN=')) {
    envContent = envContent.replace(
      /UPWORK_ACCESS_TOKEN=.*/,
      `UPWORK_ACCESS_TOKEN=${accessToken}`
    );
  } else {
    envContent += `\nUPWORK_ACCESS_TOKEN=${accessToken}`;
  }
  
  // Update or add refresh token
  if (envContent.includes('UPWORK_REFRESH_TOKEN=')) {
    envContent = envContent.replace(
      /UPWORK_REFRESH_TOKEN=.*/,
      `UPWORK_REFRESH_TOKEN=${refreshToken}`
    );
  } else {
    envContent += `\nUPWORK_REFRESH_TOKEN=${refreshToken}`;
  }
  
  fs.writeFileSync(envPath, envContent);
  console.log('✅ Tokens saved to .env file');
}

/**
 * Exchange authorization code for access token
 */
async function exchangeCodeForToken(code) {
  try {
    console.log('🔄 Exchanging authorization code for tokens...');
    
    const params = new URLSearchParams({
      grant_type: 'authorization_code',
      client_id: CLIENT_ID,
      client_secret: CLIENT_SECRET,
      code: code,
      redirect_uri: REDIRECT_URI
    });
    
    const response = await axios.post(TOKEN_URL, params, {
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Accept': 'application/json'
      }
    });
    
    const { access_token, refresh_token, expires_in } = response.data;
    
    console.log('✅ Successfully obtained tokens!');
    console.log(`   Access token expires in: ${expires_in} seconds (${expires_in / 3600} hours)`);
    
    // Save tokens to .env file
    updateEnvFile(access_token, refresh_token);
    
    return true;
  } catch (error) {
    console.error('❌ Error exchanging code for token:');
    if (error.response) {
      console.error('   Status:', error.response.status);
      console.error('   Data:', error.response.data);
    } else {
      console.error('   Message:', error.message);
    }
    return false;
  }
}

/**
 * Start local server to capture OAuth callback
 */
function startCallbackServer() {
  return new Promise((resolve, reject) => {
    const server = http.createServer(async (req, res) => {
      const url = new URL(req.url, `http://localhost:${PORT}`);
      
      if (url.pathname === '/callback') {
        const code = url.searchParams.get('code');
        const error = url.searchParams.get('error');
        
        if (error) {
          res.writeHead(400, { 'Content-Type': 'text/html' });
          res.end(`
            <html>
              <body style="font-family: Arial, sans-serif; padding: 50px; text-align: center;">
                <h1 style="color: #d32f2f;">❌ Authorization Failed</h1>
                <p>Error: ${error}</p>
                <p>You can close this window.</p>
              </body>
            </html>
          `);
          server.close();
          reject(new Error(`Authorization failed: ${error}`));
          return;
        }
        
        if (code) {
          console.log('✅ Authorization code received');
          
          // Exchange code for token
          const success = await exchangeCodeForToken(code);
          
          if (success) {
            res.writeHead(200, { 'Content-Type': 'text/html' });
            res.end(`
              <html>
                <body style="font-family: Arial, sans-serif; padding: 50px; text-align: center;">
                  <h1 style="color: #4caf50;">✅ Authorization Successful!</h1>
                  <p>Your tokens have been saved to the .env file.</p>
                  <p>You can now close this window and start the scheduler.</p>
                  <p style="margin-top: 30px; color: #666;">Run: <code>npm start</code></p>
                </body>
              </html>
            `);
            server.close();
            resolve();
          } else {
            res.writeHead(500, { 'Content-Type': 'text/html' });
            res.end(`
              <html>
                <body style="font-family: Arial, sans-serif; padding: 50px; text-align: center;">
                  <h1 style="color: #d32f2f;">❌ Token Exchange Failed</h1>
                  <p>Check the console for error details.</p>
                  <p>You can close this window.</p>
                </body>
              </html>
            `);
            server.close();
            reject(new Error('Token exchange failed'));
          }
        } else {
          res.writeHead(400, { 'Content-Type': 'text/html' });
          res.end(`
            <html>
              <body style="font-family: Arial, sans-serif; padding: 50px; text-align: center;">
                <h1 style="color: #d32f2f;">❌ No Authorization Code</h1>
                <p>You can close this window.</p>
              </body>
            </html>
          `);
          server.close();
          reject(new Error('No authorization code received'));
        }
      }
    });
    
    server.listen(PORT, () => {
      console.log(`🚀 Local callback server started on port ${PORT}`);
    });
    
    server.on('error', (err) => {
      if (err.code === 'EADDRINUSE') {
        console.error(`❌ Port ${PORT} is already in use. Please close any other applications using this port.`);
      } else {
        console.error('❌ Server error:', err.message);
      }
      reject(err);
    });
  });
}

/**
 * Open authorization URL in browser
 */
function openBrowser(url) {
  const start = process.platform === 'darwin' ? 'open' :
                process.platform === 'win32' ? 'start' : 'xdg-open';
  
  exec(`${start} "${url}"`, (error) => {
    if (error) {
      console.error('❌ Could not open browser automatically.');
      console.log('📋 Please manually open this URL in your browser:');
      console.log(`   ${url}`);
    }
  });
}

/**
 * Main authentication flow
 */
async function authenticate() {
  console.log('🔐 Upwork OAuth2 Authentication');
  console.log('================================\n');
  
  // Validate environment variables
  if (!CLIENT_ID || !CLIENT_SECRET) {
    console.error('❌ Missing required environment variables:');
    console.error('   UPWORK_API_KEY and UPWORK_API_SECRET must be set in .env file');
    process.exit(1);
  }
  
  // Build authorization URL
  const authUrl = `${AUTHORIZE_URL}?response_type=code&client_id=${CLIENT_ID}&redirect_uri=${encodeURIComponent(REDIRECT_URI)}`;
  
  console.log('📝 Step 1: Starting local callback server...');
  
  try {
    // Start callback server
    const serverPromise = startCallbackServer();
    
    // Wait a moment for server to start
    await new Promise(resolve => setTimeout(resolve, 500));
    
    console.log('\n📝 Step 2: Opening browser for authorization...');
    console.log('   Please authorize the application in your browser.\n');
    console.log('🌐 Authorization URL:');
    console.log(`   ${authUrl}\n`);
    
    // Open browser
    openBrowser(authUrl);
    
    // Wait for callback
    await serverPromise;
    
    console.log('\n✅ Authentication complete!');
    console.log('   You can now run: npm start');
    
  } catch (error) {
    console.error('\n❌ Authentication failed:', error.message);
    process.exit(1);
  }
}

// Run authentication
if (require.main === module) {
  authenticate();
}

module.exports = { authenticate };
