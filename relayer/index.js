const express = require('express');
const cors = require('cors');
const axios = require('axios');
const { Wallet, solidityPackedKeccak256, getBytes } = require('ethers');

const app = express();
const PORT = process.env.PORT || 3000;

// Enable CORS for frontend integration
app.use(cors());
app.use(express.json());

// Generate ephemeral Oracle Wallet on startup
const oracleWallet = Wallet.createRandom();
console.log('==================================================');
console.log('🔮 Monad QRNG Oracle Relayer Started');
console.log(`🔑 Oracle Public Address: ${oracleWallet.address}`);
console.log('==================================================');

// Fetch Quantum Random Number and Sign it (with qrandom.io fallback for rate-limiting protection)
app.get('/quantum-random', async (req, res) => {
  let randomNumber;
  let source = 'ANU QRNG';

  try {
    // 1. Try fetching from ANU QRNG API
    const response = await axios.get('https://qrng.anu.edu.au/API/jsonI.php?length=1&type=uint8', {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
      },
      timeout: 3000 // 3 seconds timeout for fast failover
    });

    if (response.data && response.data.success && Array.isArray(response.data.data)) {
      randomNumber = response.data.data[0];
    } else {
      throw new Error('Invalid ANU response structure');
    }
  } catch (error) {
    console.warn(`[QRNG] ANU API failed or rate-limited (${error.message}). Trying fallback qrandom.io...`);
    try {
      // 2. Fallback to qrandom.io API (which is also backed by physical quantum hardware)
      source = 'qrandom.io';
      const fallbackResponse = await axios.get('https://qrandom.io/api/random/int?min=0&max=255&n=1', {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
        },
        timeout: 4000
      });

      if (fallbackResponse.data && typeof fallbackResponse.data.number === 'number') {
        randomNumber = fallbackResponse.data.number;
      } else {
        throw new Error('Invalid qrandom.io response structure');
      }
    } catch (fallbackError) {
      console.error('[QRNG] Fallback API also failed:', fallbackError.message);
      return res.status(500).json({
        error: 'Failed to retrieve quantum randomness from all physical providers',
        details: fallbackError.message
      });
    }
  }

  try {
    if (typeof randomNumber !== 'number' || randomNumber < 0 || randomNumber > 255) {
      throw new Error('Random number out of uint8 bounds');
    }

    // 3. Hash the randomNumber using solidityPackedKeccak256 matching Solidity abi.encodePacked
    const messageHash = solidityPackedKeccak256(['uint8'], [randomNumber]);

    // 4. Sign the message hash. In ethers v6, to sign a raw hash we convert it to bytes.
    const messageBytes = getBytes(messageHash);
    const signature = await oracleWallet.signMessage(messageBytes);

    console.log(`[QRNG] Generated: ${randomNumber} (Source: ${source}) | Hash: ${messageHash} | Signed by: ${oracleWallet.address}`);

    // 5. Return response
    return res.json({
      randomNumber,
      signature,
      oracleAddress: oracleWallet.address,
      source
    });
  } catch (err) {
    console.error('Oracle Relayer Sign/Validation Error:', err.message);
    return res.status(500).json({
      error: 'Failed to process and sign quantum randomness',
      details: err.message
    });
  }
});

app.listen(PORT, () => {
  console.log(`🚀 Relayer API listening at http://localhost:${PORT}`);
});
