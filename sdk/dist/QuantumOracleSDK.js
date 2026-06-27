"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.QuantumSDK = void 0;
const ethers_1 = require("ethers");
const axios_1 = __importDefault(require("axios"));
// Minimal ABI for interacting with the consumeRandom function of the QuantumOracle contract
const ORACLE_ABI = [
    'function consumeRandom(uint8 _randomNumber, bytes calldata _signature) external',
    'function lastRandomNumber() external view address',
    'function oracleNode() external view address'
];
class QuantumSDK {
    provider;
    wallet;
    contractAddress;
    contract;
    relayerUrl;
    /**
     * @param rpcUrl Monad network RPC URL
     * @param contractAddress Deployed QuantumOracle contract address
     * @param privateKey Private key of the caller/dApp wallet that pays for transaction gas
     * @param relayerUrl Optional custom relayer URL, defaults to https://kuantum-sigma.vercel.app
     */
    constructor(rpcUrl, contractAddress, privateKey, relayerUrl = 'https://kuantum-sigma.vercel.app') {
        this.provider = new ethers_1.JsonRpcProvider(rpcUrl);
        this.wallet = new ethers_1.Wallet(privateKey, this.provider);
        this.contractAddress = contractAddress;
        this.contract = new ethers_1.Contract(contractAddress, ORACLE_ABI, this.wallet);
        this.relayerUrl = relayerUrl;
    }
    /**
     * Fetches quantum random number & signature from the off-chain relayer,
     * then submits it directly to the Monad smart contract.
     *
     * @returns The transaction hash of the successful transaction.
     */
    async fetchAndSubmitRandom() {
        try {
            console.log(`[SDK] Fetching quantum random number from relayer: ${this.relayerUrl}/quantum-random...`);
            // 1. Fetch random number and signature from off-chain relayer
            const response = await axios_1.default.get(`${this.relayerUrl}/quantum-random`);
            const { randomNumber, signature, oracleAddress } = response.data;
            if (randomNumber === undefined || !signature) {
                throw new Error('Invalid response from QRNG Relayer');
            }
            console.log(`[SDK] Quantum Number retrieved: ${randomNumber}`);
            console.log(`[SDK] Relayer Signature: ${signature}`);
            console.log(`[SDK] Signed by Oracle Address: ${oracleAddress}`);
            // 2. Submit transaction to Monad contract
            console.log(`[SDK] Submitting transaction to QuantumOracle at ${this.contractAddress}...`);
            const tx = await this.contract.consumeRandom(randomNumber, signature);
            console.log(`[SDK] Transaction submitted! Hash: ${tx.hash}`);
            // 3. Wait for confirmation
            console.log('[SDK] Waiting for block confirmation...');
            const receipt = await tx.wait();
            if (!receipt || receipt.status !== 1) {
                throw new Error('Transaction execution failed on-chain');
            }
            console.log(`[SDK] Transaction confirmed successfully in block ${receipt.blockNumber}!`);
            return tx.hash;
        }
        catch (error) {
            console.error('[SDK] Error in fetchAndSubmitRandom:', error.message || error);
            throw error;
        }
    }
    /**
     * Helper to query the last verified random number on-chain.
     */
    async getLastRandomNumber() {
        try {
            const num = await this.contract.lastRandomNumber();
            return Number(num);
        }
        catch (error) {
            console.error('[SDK] Error reading last random number:', error.message || error);
            throw error;
        }
    }
}
exports.QuantumSDK = QuantumSDK;
