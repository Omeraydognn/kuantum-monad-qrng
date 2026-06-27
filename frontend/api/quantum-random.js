const axios = require('axios');
const { Wallet, solidityPackedKeccak256, getBytes } = require('ethers');

// Initialize the wallet using a constant private key from environment variables (Production),
// or fallback to a random one (Local development testing)
const PRIVATE_KEY = process.env.ORACLE_PRIVATE_KEY;
let oracleWallet;

if (PRIVATE_KEY) {
  try {
    oracleWallet = new Wallet(PRIVATE_KEY);
  } catch (error) {
    console.error('[QRNG API] Invalid ORACLE_PRIVATE_KEY provided:', error.message);
    oracleWallet = Wallet.createRandom();
  }
} else {
  // Generate ephemeral wallet if no key provided
  oracleWallet = Wallet.createRandom();
}

module.exports = async (req, res) => {
  // CORS Headers
  res.setHeader('Access-Control-Allow-Credentials', true);
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
  res.setHeader(
    'Access-Control-Allow-Headers',
    'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version'
  );

  // Preflight request handling
  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  let randomNumber;
  let source = 'ANU QRNG';

  try {
    // 1. Fetch from ANU QRNG API
    const response = await axios.get('https://qrng.anu.edu.au/API/jsonI.php?length=1&type=uint8', {
      headers: {
        'User-Agent': 'Mozilla/5.0'
      },
      timeout: 3000
    });

    if (response.data && response.data.success && Array.isArray(response.data.data)) {
      randomNumber = response.data.data[0];
    } else {
      throw new Error('Invalid ANU response structure');
    }
  } catch (error) {
    console.warn(`[QRNG API] ANU API failed/rate-limited. Trying fallback qrandom.io...`);
    try {
      source = 'qrandom.io';
      const fallbackResponse = await axios.get('https://qrandom.io/api/random/int?min=0&max=255&n=1', {
        headers: {
          'User-Agent': 'Mozilla/5.0'
        },
        timeout: 4000
      });

      if (fallbackResponse.data && typeof fallbackResponse.data.number === 'number') {
        randomNumber = fallbackResponse.data.number;
      } else {
        throw new Error('Invalid qrandom.io response');
      }
    } catch (fallbackError) {
      return res.status(500).json({
        error: 'Failed to retrieve quantum randomness from all physical providers',
        details: fallbackError.message
      });
    }
  }

  try {
    // 2. Hash and Sign the random value
    const messageHash = solidityPackedKeccak256(['uint8'], [randomNumber]);
    const messageBytes = getBytes(messageHash);
    const signature = await oracleWallet.signMessage(messageBytes);

    console.log(`[QRNG API] Generated: ${randomNumber} (Source: ${source}) | Signed by: ${oracleWallet.address}`);

    // 3. Return JSON payload
    return res.json({
      randomNumber,
      signature,
      oracleAddress: oracleWallet.address,
      source
    });
  } catch (err) {
    return res.status(500).json({
      error: 'Failed to process and sign quantum randomness',
      details: err.message
    });
  }
};
