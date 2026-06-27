# kuantum-qrng-sdk

> Official TypeScript/JavaScript SDK for the Monad Quantum Randomness Oracle (QRNG).

Get authentic, post-quantum physical entropy on the Monad network in a single block. Powered by physical quantum vacuum fluctuations (ANU & qrandom.io) and secured via ECDSA cryptographic signatures.

---

## Installation

Install the SDK along with its peer dependency `ethers` (v6):

```bash
npm install kuantum-qrng-sdk ethers
```

---

## Quickstart

Initialize the SDK using a Monad RPC provider, the contract address, and your wallet's private key (required to pay gas fees for the transaction):

```javascript
import { QuantumSDK } from "kuantum-qrng-sdk";
import { ethers } from "ethers";

// 1. Setup provider and wallet signer
const provider = new ethers.JsonRpcProvider("https://testnet-rpc.monad.xyz");
const wallet = new ethers.Wallet("YOUR_PRIVATE_KEY", provider);

// 2. Initialize the SDK
const contractAddress = "0xe7f1725E7734CE288F8367e1Bb143E90bb3F0512";
const oracle = new QuantumSDK(provider, contractAddress, "YOUR_PRIVATE_KEY");
```

---

## Usage

### ⚡ Pull & Verify in One Click (Recommended)
Fetches the signed quantum entropy from the relayer and automatically submits the verification transaction to your Monad contract in a single step:

```javascript
async function requestQuantumRandomness() {
  try {
    console.log("Requesting quantum entropy...");
    const txHash = await oracle.fetchAndSubmitRandom();
    console.log(`Verification Transaction Submitted! Hash: ${txHash}`);
  } catch (error) {
    console.error("Failed to request quantum randomness:", error);
  }
}
```

### 🔍 Read Last Verified Number
Queries the smart contract on-chain to read the last verified quantum random value:

```javascript
async function printLastNumber() {
  const num = await oracle.getLastRandomNumber();
  console.log(`Last Verified Quantum Number: ${num}`); // uint8 (0-255)
}
```

---

## Smart Contract Integration (Solidity)

Your Monad smart contract should implement the interface to read the latest validated random number:

```solidity
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

interface IQuantumOracle {
    function lastRandomNumber() external view returns (uint8);
}

contract MyGame {
    address public oracleAddress = 0xe7f1725E7734CE288F8367e1Bb143E90bb3F0512;

    function rollDice() external returns (uint8) {
        uint8 quantumEntropy = IQuantumOracle(oracleAddress).lastRandomNumber();
        return (quantumEntropy % 6) + 1; // 1-6 Dice Roll
    }
}
```

---

## License
MIT
