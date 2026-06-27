const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("QuantumOracle Signature Verification", function () {
  let oracleContract;
  let owner;
  let oracleWallet;
  let user;

  beforeEach(async function () {
    [owner, user] = await ethers.getSigners();
    
    // Create an ephemeral wallet for the Oracle node
    oracleWallet = ethers.Wallet.createRandom();

    // Deploy contract passing the oracle node's public address
    const QuantumOracle = await ethers.getContractFactory("QuantumOracle");
    oracleContract = await QuantumOracle.deploy(oracleWallet.address);
    await oracleContract.waitForDeployment();
  });

  it("should deploy with the correct oracle address", async function () {
    expect(await oracleContract.oracleNode()).to.equal(oracleWallet.address);
  });

  it("should verify a valid signature and update lastRandomNumber", async function () {
    const randomNumber = 137; // Example uint8 random number

    // 1. Hash the number using solidityPackedKeccak256
    const messageHash = ethers.solidityPackedKeccak256(["uint8"], [randomNumber]);

    // 2. Sign the hash with the oracle's private key (converting to bytes first so it signs standard 32-byte hash)
    const messageBytes = ethers.getBytes(messageHash);
    const signature = await oracleWallet.signMessage(messageBytes);

    // 3. Call consumeRandom from a standard user address
    const tx = await oracleContract.connect(user).consumeRandom(randomNumber, signature);
    await tx.wait();

    // 4. Verify lastRandomNumber has been updated on-chain
    expect(await oracleContract.lastRandomNumber()).to.equal(randomNumber);
  });

  it("should revert if the signature is invalid (wrong random number)", async function () {
    const randomNumber = 42;
    const tamperedNumber = 43;

    const messageHash = ethers.solidityPackedKeccak256(["uint8"], [randomNumber]);
    const messageBytes = ethers.getBytes(messageHash);
    const signature = await oracleWallet.signMessage(messageBytes);

    // Submitting a different number than the signed one should fail verification
    await expect(
      oracleContract.connect(user).consumeRandom(tamperedNumber, signature)
    ).to.be.revertedWith("Gecersiz Oracle Imzasi");
  });

  it("should revert if the signature is signed by a different key", async function () {
    const randomNumber = 99;
    const randomUserWallet = ethers.Wallet.createRandom();

    const messageHash = ethers.solidityPackedKeccak256(["uint8"], [randomNumber]);
    const messageBytes = ethers.getBytes(messageHash);
    
    // Signed by someone else who is NOT the oracle Node
    const signature = await randomUserWallet.signMessage(messageBytes);

    await expect(
      oracleContract.connect(user).consumeRandom(randomNumber, signature)
    ).to.be.revertedWith("Gecersiz Oracle Imzasi");
  });

  it("should allow the owner to update the oracle address", async function () {
    const newOracleWallet = ethers.Wallet.createRandom();

    await expect(
      oracleContract.connect(owner).updateOracleAddress(newOracleWallet.address)
    )
      .to.emit(oracleContract, "OracleNodeUpdated")
      .withArgs(oracleWallet.address, newOracleWallet.address);

    expect(await oracleContract.oracleNode()).to.equal(newOracleWallet.address);
  });

  it("should prevent non-owners from updating the oracle address", async function () {
    const newOracleWallet = ethers.Wallet.createRandom();

    await expect(
      oracleContract.connect(user).updateOracleAddress(newOracleWallet.address)
    ).to.be.reverted; // Reverts due to Ownable restrictions
  });
});
