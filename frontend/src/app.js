import { ethers } from 'ethers';
import { EthereumProvider } from '@walletconnect/ethereum-provider';

// System State Variables
let userProvider = null;
let userSigner = null;
let userAddress = null;
let fetchedData = null; // Stores { randomNumber, signature, oracleAddress }
let walletConnectProvider = null;

// Minimal Contract ABI
const CONTRACT_ABI = [
  "function consumeRandom(uint8 _randomNumber, bytes memory _signature) public",
  "function updateOracleAddress(address _newOracle) public",
  "function oracleNode() public view returns (address)",
  "function lastRandomNumber() public view returns (uint8)"
];

// Get UI Elements
const btnConnect = document.getElementById('btn-connect');
const btnConnectWc = document.getElementById('btn-connect-wc');
const btnUpdateOracle = document.getElementById('btn-update-oracle');
const btnFetch = document.getElementById('btn-fetch');
const btnSubmit = document.getElementById('btn-submit');
const btnInstant = document.getElementById('btn-instant');
const btnCopyWcUri = document.getElementById('btn-copy-wc-uri');

const inputContract = document.getElementById('input-contract');
const inputRelayer = document.getElementById('input-relayer');
const inputWcProjectId = document.getElementById('input-wc-project-id');

const outNumber = document.getElementById('out-number');
const outOracleAddress = document.getElementById('out-oracle-address');
const outSignature = document.getElementById('out-signature');
const outTxHash = document.getElementById('out-tx-hash');
const walletStatus = document.getElementById('wallet-status');
const consoleDiv = document.getElementById('console');
const wcQrArea = document.getElementById('wc-qr-area');
const wcQrImage = document.getElementById('wc-qr-image');
const wcUriText = document.getElementById('wc-uri-text');

// Load saved contract address if exists
if (localStorage.getItem('quantumContractAddress')) {
  inputContract.value = localStorage.getItem('quantumContractAddress');
}

// Save contract address on change
inputContract.addEventListener('input', () => {
  localStorage.setItem('quantumContractAddress', inputContract.value.trim());
  updateSubmitButtonStates();
});

// Helper Logger
function log(message, type = 'info') {
  const entry = document.createElement('div');
  entry.className = `console-entry entry-${type}`;
  entry.innerText = `[${new Date().toLocaleTimeString()}] ${message}`;
  consoleDiv.appendChild(entry);
  consoleDiv.scrollTop = consoleDiv.scrollHeight;
}

// Connect to MetaMask
async function connectWallet() {
  if (!window.ethereum) {
    log('Hata: MetaMask tarayıcınızda yüklü değil.', 'error');
    alert('MetaMask bulunamadı! Lütfen MetaMask kurun.');
    return;
  }
  try {
    log('MetaMask bağlantısı kuruluyor...', 'info');
    userProvider = new ethers.BrowserProvider(window.ethereum);
    
    // Request accounts
    const accounts = await window.ethereum.request({ method: 'eth_requestAccounts' });
    userAddress = accounts[0];
    userSigner = await userProvider.getSigner();

    walletStatus.innerText = 'Bağlandı';
    walletStatus.className = 'badge badge-connected';
    btnConnect.innerText = `${userAddress.slice(0, 6)}...${userAddress.slice(-4)}`;
    log(`Cüzdan bağlandı: ${userAddress}`, 'success');

    updateSubmitButtonStates();

    // Listen to account changes
    window.ethereum.on('accountsChanged', (accounts) => {
      if (accounts.length === 0) {
        userAddress = null;
        walletStatus.innerText = 'Bağlı Değil';
        walletStatus.className = 'badge badge-disconnected';
        btnConnect.innerText = 'MetaMask Bağla';
        log('Cüzdan bağlantısı kesildi.', 'error');
      } else {
        userAddress = accounts[0];
        btnConnect.innerText = `${userAddress.slice(0, 6)}...${userAddress.slice(-4)}`;
        log(`Cüzdan değiştirildi: ${userAddress}`, 'info');
      }
      updateSubmitButtonStates();
    });

  } catch (error) {
    log(`Cüzdan bağlantı hatası: ${error.message}`, 'error');
  }
}

function updateSubmitButtonStates() {
  const isWalletConnected = !!userAddress;
  const isContractEntered = inputContract.value.trim().startsWith('0x') && inputContract.value.trim().length === 42;
  const hasFetchedData = !!fetchedData;

  btnSubmit.disabled = !(isWalletConnected && isContractEntered && hasFetchedData);
  btnInstant.disabled = !(isWalletConnected && isContractEntered);
  btnUpdateOracle.disabled = !(isWalletConnected && isContractEntered && hasFetchedData);
}

// Connect to WalletConnect
async function connectWalletConnect() {
  const projectId = inputWcProjectId.value.trim();
  if (!projectId || projectId.length !== 32) {
    log('Hata: WalletConnect için 32 karakterlik geçerli bir Project ID girilmelidir.', 'error');
    alert('Lütfen geçerli bir WalletConnect Project ID girin.');
    return;
  }

  log('WalletConnect bağlantı oturumu oluşturuluyor...', 'info');
  try {
    walletConnectProvider = await EthereumProvider.init({
      projectId: projectId,
      optionalChains: [1, 31337], // Ethereum Mainnet, Hardhat Local Node
      showQrModal: false, // Disabling built-in modal to capture URI and display custom QR
    });

    // Listen to display_uri event to capture the connection string
    walletConnectProvider.on('display_uri', (uri) => {
      log('WalletConnect URI üretildi. QR kodu yükleniyor...', 'info');
      
      // Show QR Code Area
      wcQrArea.style.display = 'block';
      wcQrImage.src = `https://api.qrserver.com/v1/create-qr-code/?size=180x180&data=${encodeURIComponent(uri)}`;
      wcUriText.value = uri;
    });

    // Trigger connection (will cause display_uri to fire)
    const connectPromise = walletConnectProvider.connect();
    
    // Await the connection
    await connectPromise;

    // Hide QR Code Area once connected
    wcQrArea.style.display = 'none';

    userProvider = new ethers.BrowserProvider(walletConnectProvider);
    userAddress = walletConnectProvider.accounts[0];
    userSigner = await userProvider.getSigner();

    walletStatus.innerText = 'WC Bağlandı';
    walletStatus.className = 'badge badge-connected';
    btnConnectWc.innerText = `WC: ${userAddress.slice(0, 6)}...${userAddress.slice(-4)}`;
    log(`WalletConnect ile bağlanıldı: ${userAddress}`, 'success');

    updateSubmitButtonStates();

    // WalletConnect listeners
    walletConnectProvider.on('accountsChanged', (accounts) => {
      if (accounts.length === 0) {
        userAddress = null;
        walletStatus.innerText = 'Bağlı Değil';
        walletStatus.className = 'badge badge-disconnected';
        btnConnectWc.innerText = 'WalletConnect Bağla';
        log('WalletConnect bağlantısı kesildi.', 'error');
      } else {
        userAddress = accounts[0];
        btnConnectWc.innerText = `WC: ${userAddress.slice(0, 6)}...${userAddress.slice(-4)}`;
        log(`WalletConnect cüzdanı değiştirildi: ${userAddress}`, 'info');
      }
      updateSubmitButtonStates();
    });

    walletConnectProvider.on('disconnect', () => {
      userAddress = null;
      walletStatus.innerText = 'Bağlı Değil';
      walletStatus.className = 'badge badge-disconnected';
      btnConnectWc.innerText = 'WalletConnect Bağla';
      log('WalletConnect oturumu sonlandırıldı.', 'error');
      updateSubmitButtonStates();
    });

  } catch (error) {
    log(`WalletConnect Bağlantı Hatası: ${error.message || error}`, 'error');
    alert(`WalletConnect Hatası: ${error.message || error}`);
  }
}

// 1. Fetch Quantum Random Number from Relayer
async function fetchQuantumRandom() {
  const relayerUrl = inputRelayer.value.trim() || 'http://localhost:3000';
  btnFetch.disabled = true;
  btnFetch.innerText = 'Veri Çekiliyor...';
  log(`Relayer sunucusundan veri talep ediliyor: ${relayerUrl}/quantum-random...`, 'info');

  try {
    const response = await fetch(`${relayerUrl}/quantum-random`);
    if (!response.ok) {
      throw new Error(`HTTP Hata kodu: ${response.status}`);
    }
    
    const data = await response.json();
    fetchedData = data;

    // Update UI
    outNumber.innerText = data.randomNumber;
    outOracleAddress.innerText = data.oracleAddress;
    outSignature.innerText = data.signature;

    log(`Oracle'dan veri başarıyla çekildi! Değer: ${data.randomNumber} (Kaynak: ${data.source || 'Bilinmiyor'})`, 'success');
    log(`Oracle Cüzdan Adresi: ${data.oracleAddress}`, 'accent');
    log(`Kuantum İmza: ${data.signature.slice(0, 16)}...`, 'info');

    updateSubmitButtonStates();
  } catch (error) {
    log(`Relayer'dan veri çekme hatası: ${error.message}`, 'error');
    alert(`Relayer hatası: ${error.message}`);
    fetchedData = null;
    outNumber.innerText = '-';
    outOracleAddress.innerText = '-';
    outSignature.innerText = '-';
    updateSubmitButtonStates();
  } finally {
    btnFetch.disabled = false;
    btnFetch.innerText = '1. Relayer\'dan Kuantum Verisi Çek';
  }
}

// 2. Submit transaction to Monad contract
async function submitToBlockchain() {
  if (!fetchedData) {
    log('Hata: Önce Oracle\'dan veri çekmelisiniz.', 'error');
    return;
  }

  const contractAddress = inputContract.value.trim();
  log(`İşlem hazırlanıyor... Hedef Kontrat: ${contractAddress}`, 'info');

  try {
    btnSubmit.disabled = true;
    btnInstant.disabled = true;
    btnSubmit.innerText = 'Cüzdan Onayı Bekleniyor...';

    const contract = new ethers.Contract(contractAddress, CONTRACT_ABI, userSigner);

    log(`Cüzdan üzerinden consumeRandom(${fetchedData.randomNumber}, ...) çağrısı onayınızı bekliyor.`, 'info');
    
    const tx = await contract.consumeRandom(fetchedData.randomNumber, fetchedData.signature);
    log(`İşlem gönderildi! Hash: ${tx.hash}`, 'accent');
    outTxHash.innerHTML = `<a href="#" onclick="return false;" style="color: var(--accent-color);">${tx.hash}</a>`;

    log('İşlemin blockchain ağında onaylanması bekleniyor...', 'info');
    const receipt = await tx.wait();

    if (receipt.status === 1) {
      log(`Tebrikler! İşlem onaylandı. Blok: ${receipt.blockNumber}`, 'success');
      
      // Verify on-chain update
      const onChainVal = await contract.lastRandomNumber();
      log(`On-Chain Doğrulanan Kuantum Sayısı: ${onChainVal}`, 'success');
    } else {
      throw new Error('İşlem başarısız oldu (Reverted)');
    }

  } catch (error) {
    log(`Blockchain İşlem Hatası: ${error.message || error}`, 'error');
    alert(`Hata: ${error.message || error}`);
  } finally {
    updateSubmitButtonStates();
    btnSubmit.innerText = '2. Monad\'da Doğrula & Kaydet';
  }
}

// Instant Pull-Based Flow (Fetch + Submit)
async function instantPullAndSubmit() {
  await fetchQuantumRandom();
  if (fetchedData) {
    await submitToBlockchain();
  }
}

// Owner only function: Update Oracle Address in smart contract
async function updateOracleInContract() {
  if (!fetchedData) return;
  const contractAddress = inputContract.value.trim();
  try {
    btnUpdateOracle.disabled = true;
    btnUpdateOracle.innerText = 'Güncelleniyor...';
    log(`Oracle adresi güncelleniyor. Yeni Adres: ${fetchedData.oracleAddress}`, 'info');
    
    const contract = new ethers.Contract(contractAddress, CONTRACT_ABI, userSigner);
    const tx = await contract.updateOracleAddress(fetchedData.oracleAddress);
    log(`İşlem gönderildi! Hash: ${tx.hash}`, 'accent');
    
    await tx.wait();
    log(`Oracle yetkili adresi başarıyla güncellendi!`, 'success');
  } catch (error) {
    log(`Oracle Adresi Güncelleme Hatası: ${error.message}`, 'error');
    alert(`Hata: ${error.message}`);
  } finally {
    updateSubmitButtonStates();
    btnUpdateOracle.innerText = 'Oracle Adresini Kontrata Tanıt';
  }
}

// Event Listeners
btnConnect.addEventListener('click', connectWallet);
btnConnectWc.addEventListener('click', connectWalletConnect);
btnFetch.addEventListener('click', fetchQuantumRandom);
btnSubmit.addEventListener('click', submitToBlockchain);
btnInstant.addEventListener('click', instantPullAndSubmit);
btnUpdateOracle.addEventListener('click', updateOracleInContract);

// WalletConnect URI Copy Listener
btnCopyWcUri.addEventListener('click', () => {
  if (wcUriText && wcUriText.value) {
    wcUriText.select();
    navigator.clipboard.writeText(wcUriText.value);
    log('WalletConnect bağlantı kodu panoya kopyalandı!', 'success');
  }
});
