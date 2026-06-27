// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";
import "@openzeppelin/contracts/utils/cryptography/MessageHashUtils.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

/**
 * @title QuantumOracle
 * @dev Monad Ağında Kuantum Rastgelelik Oracle'ı (QRNG) MVP Akıllı Kontratı.
 * Fiziksel kuantum kaynağından (ANU) alınıp off-chain relayer tarafından imzalanan
 * veriyi on-chain olarak doğrular.
 */
contract QuantumOracle is Ownable {
    // ECDSA kütüphanesini bytes32 ve bytes tipleri için etkinleştiriyoruz
    using ECDSA for bytes32;
    using MessageHashUtils for bytes32;

    // Yetkili Oracle sunucusunun public adresi
    address public oracleNode;

    // Sistemde doğrulanan en son kuantum rastgele sayı
    uint8 public lastRandomNumber;

    // Her yeni kuantum rastgele sayısı başarıyla doğrulandığında tetiklenen olay
    event QuantumRandomNumberConsumed(
        address indexed consumer,
        uint8 randomNumber,
        bytes32 indexed messageHash
    );

    // Oracle adresi güncellendiğinde tetiklenen olay
    event OracleNodeUpdated(address indexed oldOracle, address indexed newOracle);

    /**
     * @dev Kontrat başlatılırken yetkili oracle adresi belirlenir.
     * @param _initialOracle Yetkili Oracle Relayer'ın cüzdan adresi.
     */
    constructor(address _initialOracle) Ownable(msg.sender) {
        require(_initialOracle != address(0), "Gecersiz oracle adresi");
        oracleNode = _initialOracle;
        emit OracleNodeUpdated(address(0), _initialOracle);
    }

    /**
     * @dev Oracle adresini güncelleme yetkisi sunar (Oracle Relayer her başladığında 
     * yeni cüzdan ürettiği için MVP testlerinde bu fonksiyon gereklidir).
     * @param _newOracle Yeni Oracle adresi.
     */
    function updateOracleAddress(address _newOracle) external onlyOwner {
        require(_newOracle != address(0), "Gecersiz oracle adresi");
        emit OracleNodeUpdated(oracleNode, _newOracle);
        oracleNode = _newOracle;
    }

    /**
     * @dev Relayer'dan alınan kuantum sayısını ve imzayı doğrular.
     * @param _randomNumber API'den gelen ve imzalanan uint8 rastgele sayı.
     * @param _signature Relayer private key'i ile atılan ECDSA imzası.
     */
    function consumeRandom(uint8 _randomNumber, bytes memory _signature) public {
        // 1. Off-chain Relayer ile aynı şekilde veriyi hash'le (solidityPackedKeccak256)
        bytes32 messageHash = keccak256(abi.encodePacked(_randomNumber));

        // 2. Ethereum Signed Message formatına dönüştür (prefix ekle)
        bytes32 ethSignedMessageHash = messageHash.toEthSignedMessageHash();

        // 3. İmzadan adresi çıkar (Recover)
        address recoveredSigner = ethSignedMessageHash.recover(_signature);

        // 4. İmzacının yetkili Oracle adresi olduğunu doğrula
        require(recoveredSigner == oracleNode, "Gecersiz Oracle Imzasi");

        // 5. Durumu güncelle ve olayı tetikle
        lastRandomNumber = _randomNumber;
        emit QuantumRandomNumberConsumed(msg.sender, _randomNumber, messageHash);
    }
}
