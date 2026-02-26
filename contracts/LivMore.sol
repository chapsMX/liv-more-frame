// SPDX-License-Identifier: MIT
pragma solidity ^0.8.22;

// ─────────────────────────────────────────────────────────────
//  LivMore  ·  OG NFT  ·  100% on-chain  ·  Base
//  Open edition  ·  Free mint  ·  1 per FID / wallet
//  One step at a time
// ─────────────────────────────────────────────────────────────

import "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/Pausable.sol";
import "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";
import "@openzeppelin/contracts/utils/cryptography/MessageHashUtils.sol";
import "@openzeppelin/contracts/utils/Strings.sol";
import "@openzeppelin/contracts/utils/Base64.sol";

contract LivMoreOG is ERC721, Ownable, Pausable {
    using ECDSA for bytes32;
    using Strings for uint256;

    // ── State ──────────────────────────────────────────────────

    address public verifierAddress;
    uint256 public totalSupply;

    struct TokenData {
        string  username;
        uint256 mintTimestamp;
        uint256 seed;
    }

    mapping(uint256 => TokenData) private _tokenData;
    mapping(uint256 => bool)      private _fidMinted;
    mapping(address => bool)      private _walletMinted;

    // ── Events ─────────────────────────────────────────────────

    event Minted(uint256 indexed fid, address indexed to, string username);
    event VerifierUpdated(address indexed verifier);

    // ── Constructor ────────────────────────────────────────────

    constructor(address initialOwner)
        ERC721("LivMore OG", "LMOG")
        Ownable(initialOwner)
    {}

    // ── Owner controls ─────────────────────────────────────────

    function setPaused(bool paused_) external onlyOwner {
        paused_ ? _pause() : _unpause();
    }

    function setVerifier(address _verifier) external onlyOwner {
        verifierAddress = _verifier;
        emit VerifierUpdated(_verifier);
    }

    // ── Mint ───────────────────────────────────────────────────

    /**
     * @notice Mint a Steps OG token.
     * @dev Backend signs (fid, recipient, username, contractAddress, chainId, deadline)
     *      using EIP-191. Without a valid signature the mint reverts — prevents
     *      anyone from minting directly on a block explorer with a fake FID.
     *
     * @param fid       Farcaster ID — also used as the tokenId
     * @param username  Farcaster username stored on-chain and rendered in the SVG
     * @param deadline  Unix timestamp after which the signature expires
     * @param signature Backend EIP-191 signature
     */
    function mint(
        uint256 fid,
        string  calldata username,
        uint256 deadline,
        bytes   calldata signature
    ) external whenNotPaused {
        require(block.timestamp <= deadline,  "Signature expired");
        require(!_fidMinted[fid],             "FID already minted");
        require(!_walletMinted[msg.sender],   "Wallet already minted");
        require(bytes(username).length > 0,   "Username required");

        if (verifierAddress != address(0)) {
            require(
                _verifySignature(fid, msg.sender, username, deadline, signature),
                "Invalid signature"
            );
        }

        // Pseudo-random seed: deterministic once mined, not predictable before.
        uint256 seed = uint256(keccak256(abi.encodePacked(
            blockhash(block.number - 1),
            fid,
            msg.sender,
            block.timestamp
        )));

        _tokenData[fid] = TokenData({
            username:      username,
            mintTimestamp: block.timestamp,
            seed:          seed
        });

        _fidMinted[fid]           = true;
        _walletMinted[msg.sender] = true;

        _safeMint(msg.sender, fid);
        totalSupply++;
        emit Minted(fid, msg.sender, username);
    }

    // ── Signature verification ─────────────────────────────────

    /**
     * @dev Signature schema (EIP-191):
     *
     *   typeHash = keccak256(
     *     "StepsOGMint(uint256 fid,address recipient,string username,
     *                  address contractAddress,uint256 chainId,uint256 deadline)"
     *   )
     *   msgHash  = keccak256(abi.encode(
     *     typeHash, fid, recipient, keccak256(bytes(username)),
     *     address(this), block.chainid, deadline
     *   ))
     *   signed   = toEthSignedMessageHash(msgHash)
     *   sig      = sign(signed, backendPrivateKey)
     */
    function _verifySignature(
        uint256          fid,
        address          recipient,
        string  calldata username,
        uint256          deadline,
        bytes   calldata signature
    ) internal view returns (bool) {
        bytes32 typeHash = keccak256(
            "StepsOGMint(uint256 fid,address recipient,string username,"
            "address contractAddress,uint256 chainId,uint256 deadline)"
        );
        bytes32 msgHash = keccak256(abi.encode(
            typeHash,
            fid,
            recipient,
            keccak256(bytes(username)),
            address(this),
            block.chainid,
            deadline
        ));
        bytes32 ethSigned = MessageHashUtils.toEthSignedMessageHash(msgHash);
        return ECDSA.recover(ethSigned, signature) == verifierAddress;
    }

    // ═══════════════════════════════════════════════════════════
    //  SVG GENERATION — 100% on-chain
    // ═══════════════════════════════════════════════════════════

    // ── Palettes ───────────────────────────────────────────────

    string[8] private _bgColors = [
        "#05050F","#0A0500","#00080A","#0A0005",
        "#00050A","#080005","#050A00","#08080A"
    ];
    string[8] private _accentColors = [
        "#39FF14","#FF6B00","#00CFFF","#FF2DF7",
        "#FFD700","#00FFA3","#FF3860","#B4FF39"
    ];
    string[8] private _dimColors = [
        "#1A6B0A","#6B2F00","#005A6B","#6B006B",
        "#6B5A00","#006B44","#6B0A1A","#4A6B00"
    ];
    string[6] private _opacities = ["0.08","0.14","0.22","0.34","0.50","0.68"];

    // ── Triangle lookup ───────────────────────────────────
    //  rot 0°  → vertices at   0°, 120°, 240°
    //  rot 30° → vertices at  30°, 150°, 270°
    //  rot 60° → vertices at  60°, 180°, 300°
    //  rot 90° → vertices at  90°, 210°, 330°
    //  rot 120°→ vertices at 120°, 240°, 360°
    //  rot 150°→ vertices at 150°, 270°,  30°

    int16[18] private _triCos = [
        //       v0          v1          v2
        int16( 1000), int16( -500), int16( -500),   // rot   0°
        int16(  866), int16( -866), int16(    0),   // rot  30°
        int16(  500), int16(-1000), int16(  500),   // rot  60°
        int16(    0), int16( -866), int16(  866),   // rot  90°
        int16( -500), int16( -500), int16( 1000),   // rot 120°
        int16( -866), int16(    0), int16(  866)    // rot 150°
    ];

    int16[18] private _triSin = [
        //       v0          v1          v2
        int16(    0), int16(  866), int16( -866),   // rot   0°
        int16(  500), int16(  500), int16(-1000),   // rot  30°
        int16(  866), int16(    0), int16( -866),   // rot  60°
        int16( 1000), int16( -500), int16( -500),   // rot  90°
        int16(  866), int16( -866), int16(    0),   // rot 120°
        int16(  500), int16(-1000), int16(  500)    // rot 150°
    ];

    // ── RNG helper ─────────────────────────────────────────────

    function _rng(uint256 seed, uint256 nonce, uint256 mod) internal pure returns (uint256) {
        return uint256(keccak256(abi.encodePacked(seed, nonce))) % mod;
    }

    // ── Signed int → string ────────────────────────────────────

    function _itoa(int256 v) internal pure returns (string memory) {
        if (v >= 0) return uint256(v).toString();
        return string(abi.encodePacked("-", uint256(-v).toString()));
    }

    // ── Circles background ─────────────────────────────────────

    function _buildGlow(uint256 seed, string memory ac, string memory dim)
        internal view returns (string memory)
    {
        string memory s = "";
        for (uint256 i = 0; i < 3; i++) {
            uint256 cx = _rng(seed, 400 + i * 3, 500);
            uint256 cy = _rng(seed, 401 + i * 3, 500);
            uint256 r  = _rng(seed, 402 + i * 3, 140) + 80;
            s = string(abi.encodePacked(
                s,
                '<circle cx="', cx.toString(), '" cy="', cy.toString(),
                '" r="', r.toString(), '" fill="', i == 1 ? dim : ac, '" opacity="0.06"/>'
            ));
        }
        return s;
    }

    // ── Circles ─────────────────────────────────────────

    function _buildCircles(uint256 seed, uint256 count, string memory ac, string memory dim)
        internal view returns (string memory)
    {
        string memory s = "";
        for (uint256 i = 0; i < count; i++) {
            uint256 cx     = _rng(seed, 100 + i * 6, 430) + 35;
            uint256 cy     = _rng(seed, 101 + i * 6, 370) + 65;
            uint256 r      = _rng(seed, 102 + i * 6, 28)  + 5;
            string memory op    = _opacities[_rng(seed, 103 + i * 6, 6)];
            string memory color = _rng(seed, 104 + i * 6, 3) == 0 ? dim : ac;
            bool filled         = _rng(seed, 105 + i * 6, 2) == 0;

            if (filled) {
                s = string(abi.encodePacked(
                    s,
                    '<circle cx="', cx.toString(), '" cy="', cy.toString(),
                    '" r="', r.toString(), '" fill="', color, '" opacity="', op, '"/>'
                ));
            } else {
                s = string(abi.encodePacked(
                    s,
                    '<circle cx="', cx.toString(), '" cy="', cy.toString(),
                    '" r="', r.toString(),
                    '" fill="none" stroke="', color, '" stroke-width="0.9" opacity="', op, '"/>'
                ));
            }
        }
        return s;
    }

    // ── Rectangles ──────────────────────────────────────

    function _buildRects(uint256 seed, uint256 count, string memory ac, string memory dim)
        internal view returns (string memory)
    {
        string memory s = "";
        for (uint256 i = 0; i < count; i++) {
            s = _appendRect(s, seed, i, ac, dim);
        }
        return s;
    }

    function _appendRect(
        string memory s,
        uint256 seed,
        uint256 i,
        string memory ac,
        string memory dim
    ) internal view returns (string memory) {
        string memory color = _rng(seed, 105 + i * 7, 3) == 0 ? dim : ac;
        string memory op    = _opacities[_rng(seed, 104 + i * 7, 6)];
        string memory geo   = string(abi.encodePacked(
            '<rect x="',  (_rng(seed, 100 + i * 7, 400) + 20).toString(),
            '" y="',      (_rng(seed, 101 + i * 7, 360) + 50).toString(),
            '" width="',  (_rng(seed, 102 + i * 7, 60)  + 12).toString(),
            '" height="', (_rng(seed, 103 + i * 7, 60)  + 12).toString(),
            '" rx="',     _rng(seed, 107 + i * 7, 3) == 0 ? "2" : "0", '"'
        ));
        if (_rng(seed, 106 + i * 7, 2) == 0) {
            return string(abi.encodePacked(s, geo, ' fill="', color, '" opacity="', op, '"/>'));
        } else {
            return string(abi.encodePacked(s, geo, ' fill="none" stroke="', color, '" stroke-width="0.9" opacity="', op, '"/>'));
        }
    }

    // ── Triangles ───────────────────────────────────────

    function _buildTriangles(uint256 seed, uint256 count, string memory ac, string memory dim)
        internal view returns (string memory)
    {
        string memory s = "";
        for (uint256 i = 0; i < count; i++) {
            uint256 cx     = _rng(seed, 100 + i * 7, 420) + 40;
            uint256 cy     = _rng(seed, 101 + i * 7, 360) + 70;
            uint256 r      = _rng(seed, 102 + i * 7, 30)  + 8;
            string memory op    = _opacities[_rng(seed, 103 + i * 7, 6)];
            string memory color = _rng(seed, 104 + i * 7, 3) == 0 ? dim : ac;
            bool filled         = _rng(seed, 105 + i * 7, 2) == 0;
            uint256 rotVariant  = _rng(seed, 106 + i * 7, 6);

            string memory pts = _trianglePoints(cx, cy, r, rotVariant);

            if (filled) {
                s = string(abi.encodePacked(
                    s,
                    '<polygon points="', pts, '" fill="', color, '" opacity="', op, '"/>'
                ));
            } else {
                s = string(abi.encodePacked(
                    s,
                    '<polygon points="', pts,
                    '" fill="none" stroke="', color,
                    '" stroke-width="0.9" opacity="', op, '"/>'
                ));
            }
        }
        return s;
    }

    function _trianglePoints(uint256 cx, uint256 cy, uint256 r, uint256 rotVariant)
        internal view returns (string memory pts)
    {
        pts = "";
        for (uint256 v = 0; v < 3; v++) {
            uint256 idx = rotVariant * 3 + v;
            int256 px = int256(cx) + (int256(_triCos[idx]) * int256(r)) / 1000;
            int256 py = int256(cy) + (int256(_triSin[idx]) * int256(r)) / 1000;
            pts = string(abi.encodePacked(pts, _itoa(px), ",", _itoa(py), " "));
        }
    }

    // ── Trail ───────────────────────────────────────────

    function _buildTrail(uint256 seed, string memory ac)
        internal pure returns (string memory)
    {
        string memory pts  = "";
        string memory dots = "";
        for (uint256 i = 0; i < 9; i++) {
            uint256 x = _rng(seed, 300 + i * 2, 420) + 40;
            uint256 y = _rng(seed, 301 + i * 2, 360) + 70;
            pts  = string(abi.encodePacked(pts, x.toString(), ",", y.toString(), " "));
            dots = string(abi.encodePacked(
                dots,
                '<circle cx="', x.toString(), '" cy="', y.toString(),
                '" r="3" fill="', ac, '" opacity="0.7"/>'
            ));
        }
        return string(abi.encodePacked(
            '<polyline points="', pts,
            '" fill="none" stroke="', ac,
            '" stroke-width="1.2" stroke-opacity="0.25" stroke-dasharray="5 5"/>',
            dots
        ));
    }

    // ── Text ─────────────────────────────────────

    function _buildLabels(uint256 fid, string memory username, string memory ac)
        internal pure returns (string memory)
    {
        return string(abi.encodePacked(
            _buildLabelsTop(fid, ac),
            _buildLabelsBottom(username, ac)
        ));
    }

    function _buildLabelsTop(uint256 fid, string memory ac)
        internal pure returns (string memory)
    {
        return string(abi.encodePacked(
            '<text x="250" y="275" font-family="monospace" font-size="340" font-weight="bold"'
            ' fill="#FFFFFF" text-anchor="middle" dominant-baseline="middle"'
            ' opacity="0.035" letter-spacing="-20">OG</text>',
            '<text x="28" y="64" font-family="monospace" font-size="42" font-weight="bold"'
            ' fill="', ac, '" letter-spacing="12" opacity="0.92">steps</text>',
            '<rect x="386" y="22" width="92" height="30" rx="4" fill="', ac, '" opacity="0.10"/>',
            '<rect x="386" y="22" width="92" height="30" rx="4" fill="none" stroke="',
            ac, '" stroke-width="0.8" opacity="0.35"/>',
            '<text x="432" y="43" font-family="monospace" font-size="12" fill="',
            ac, '" text-anchor="middle" letter-spacing="1" opacity="0.80">#',
            fid.toString(), '</text>'
        ));
    }

    function _buildLabelsBottom(string memory username, string memory ac)
        internal pure returns (string memory)
    {
        return string(abi.encodePacked(
            '<text x="250" y="410" font-family="monospace" font-size="22" font-weight="bold"'
            ' fill="', ac, '" text-anchor="middle" opacity="0.88">@', username, '</text>'
        ));
    }

    // ── Root SVG builder ───────────────────────────────────────

    function _buildSVG(uint256 fid, uint256 seed, string memory username)
        internal view returns (string memory)
    {
        string memory bg  = _bgColors[_rng(seed, 0, 8)];
        string memory ac  = _accentColors[_rng(seed, 1, 8)];
        string memory dim = _dimColors[_rng(seed, 2, 8)];

        // Shape type per token: 0=circles, 1=rectangles, 2=triangles
        uint256 shapeType = _rng(seed, 99, 3);

        // Density tier → shape count
        // sparse: 6–10  |  medium: 11–18  |  dense: 19–28
        uint256 tier  = _rng(seed, 98, 3);
        uint256 count = tier == 0
            ? _rng(seed, 97, 5)  + 6
            : tier == 1
            ? _rng(seed, 97, 8)  + 11
            : _rng(seed, 97, 10) + 19;

        string memory shapes;
        if      (shapeType == 0) shapes = _buildCircles(seed, count, ac, dim);
        else if (shapeType == 1) shapes = _buildRects(seed, count, ac, dim);
        else                     shapes = _buildTriangles(seed, count, ac, dim);

        return string(abi.encodePacked(
            '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 500 500">',
            '<rect width="500" height="500" fill="', bg, '"/>',
            _buildGlow(seed, ac, dim),
            shapes,
            _buildTrail(seed, ac),
            _buildLabels(fid, username, ac),
            '</svg>'
        ));
    }

    // ── tokenURI ───────────────────────────────────────────────

    function tokenURI(uint256 tokenId) public view override returns (string memory) {
        require(_ownerOf(tokenId) != address(0), "Token does not exist");
        TokenData memory d = _tokenData[tokenId];
        return string(abi.encodePacked(
            "data:application/json;base64,",
            Base64.encode(bytes(_buildJSON(tokenId, d)))
        ));
    }

    function _buildJSON(uint256 tokenId, TokenData memory d)
        internal view returns (string memory)
    {
        string memory image = string(abi.encodePacked(
            "data:image/svg+xml;base64,",
            Base64.encode(bytes(_buildSVG(tokenId, d.seed, d.username)))
        ));
        string memory bgPalette = string(abi.encodePacked(
            _bgColors[0], ", ", _bgColors[1], ", ", _bgColors[2], ", ", _bgColors[3], ", ",
            _bgColors[4], ", ", _bgColors[5], ", ", _bgColors[6], ", ", _bgColors[7]
        ));
        string memory attrs = string(abi.encodePacked(
            '{"trait_type":"FID","value":', tokenId.toString(), '},',
            '{"trait_type":"Username","value":"', d.username, '"}',
            ',{"trait_type":"Type","value":"OG"}',
            ',{"trait_type":"Mint Timestamp","display_type":"date","value":',
            d.mintTimestamp.toString(), '}',
            ',{"trait_type":"Background Palette","value":"', bgPalette, '"}'
        ));
        return string(abi.encodePacked(
            '{"name":"LivMore OG #', tokenId.toString(),
            '","description":"Tracking your healthy habits, one step at a time.",',
            '"image":"', image, '","attributes":[', attrs, ']}' 
        ));
    }

    // ── View helpers ───────────────────────────────────────────

    function getTokenData(uint256 fid) external view returns (TokenData memory) {
        return _tokenData[fid];
    }

    function isFidMinted(uint256 fid) external view returns (bool) {
        return _fidMinted[fid];
    }

    function isWalletMinted(address wallet) external view returns (bool) {
        return _walletMinted[wallet];
    }
}