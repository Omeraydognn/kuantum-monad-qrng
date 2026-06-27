export declare class QuantumSDK {
    private provider;
    private wallet;
    private contractAddress;
    private contract;
    private relayerUrl;
    /**
     * @param rpcUrl Monad network RPC URL
     * @param contractAddress Deployed QuantumOracle contract address
     * @param privateKey Private key of the caller/dApp wallet that pays for transaction gas
     * @param relayerUrl Optional custom relayer URL, defaults to https://kuantum-sigma.vercel.app
     */
    constructor(rpcUrl: string, contractAddress: string, privateKey: string, relayerUrl?: string);
    /**
     * Fetches quantum random number & signature from the off-chain relayer,
     * then submits it directly to the Monad smart contract.
     *
     * @returns The transaction hash of the successful transaction.
     */
    fetchAndSubmitRandom(): Promise<string>;
    /**
     * Helper to query the last verified random number on-chain.
     */
    getLastRandomNumber(): Promise<number>;
}
