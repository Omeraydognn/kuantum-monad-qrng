import { JsonRpcProvider, Wallet, Contract } from 'ethers';
import axios from 'axios';

// Minimal ABI for interacting with the consumeRandom function of the QuantumOracle contract
const ORACLE_ABI = [
  'function consumeRandom(uint8 _randomNumber, bytes calldata _signature) external',
  'function lastRandomNumber() external view address',
  'function oracleNode() external view address'
];

export class QuantumSDK {
  private provider: JsonRpcProvider;
  private wallet: Wallet;
  private contractAddress: string;
  private contract: Contract;
  private relayerUrl: string;

  /**
   * @param rpcUrl Monad network RPC URL
   * @param contractAddress Deployed QuantumOracle contract address
   * @param privateKey Private key of the caller/dApp wallet that pays for transaction gas
   * @param relayerUrl Optional custom relayer URL, defaults to https://kuantum-sigma.vercel.app
   */
  constructor(
    rpcUrl: string,
    contractAddress: string,
    privateKey: string,
    relayerUrl: string = 'https://kuantum-sigma.vercel.app'
  ) {
    this.provider = new JsonRpcProvider(rpcUrl);
    this.wallet = new Wallet(privateKey, this.provider);
    this.contractAddress = contractAddress;
    this.contract = new Contract(contractAddress, ORACLE_ABI, this.wallet);
    this.relayerUrl = relayerUrl;
  }

  /**
   * Fetches quantum random number & signature from the off-chain relayer,
   * then submits it directly to the Monad smart contract.
   * 
   * @returns The transaction hash of the successful transaction.
   */
  async fetchAndSubmitRandom(): Promise<string> {
    try {
      console.log(`[SDK] Fetching quantum random number from relayer: ${this.relayerUrl}/quantum-random...`);
      
      // 1. Fetch random number and signature from off-chain relayer
      const response = await axios.get(`${this.relayerUrl}/quantum-random`);
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

    } catch (error: any) {
      console.error('[SDK] Error in fetchAndSubmitRandom:', error.message || error);
      throw error;
    }
  }

  /**
   * Helper to query the last verified random number on-chain.
   */
  async getLastRandomNumber(): Promise<number> {
    try {
      const num = await this.contract.lastRandomNumber();
      return Number(num);
    } catch (error: any) {
      console.error('[SDK] Error reading last random number:', error.message || error);
      throw error;
    }
  }
}
