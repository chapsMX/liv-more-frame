// SPDX-License-Identifier: MIT
pragma solidity ^0.8.22;

// ─────────────────────────────────────────────────────────────
//  Steps OG  ·  ERC-721  ·  100% on-chain  ·  Base
//  Open edition  ·  Free mint  ·  1 per FID / wallet
// ─────────────────────────────────────────────────────────────

import "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/Pausable.sol";
import "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";
import "@openzeppelin/contracts/utils/cryptography/MessageHashUtils.sol";
import "@openzeppelin/contracts/utils/Strings.sol";
import "@openzeppelin/contracts/utils/Base64.sol";

contract stepsTest is ERC721, Ownable, Pausable {
    using ECDSA for bytes32;
    using Strings for uint256;

    // ── State (minimal — no SVG data in storage) ───────────────

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
        ERC721("stepsTest", "TEST")
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

    function mint(
        uint256 fid,
        string  calldata username,
        uint256 deadline,
        bytes   calldata signature
    ) external whenNotPaused {
        require(block.timestamp <= deadline, "Signature expired");
        require(!_fidMinted[fid],            "FID already minted");
        require(!_walletMinted[msg.sender],  "Wallet already minted");
        require(bytes(username).length > 0,  "Username required");

        if (verifierAddress != address(0)) {
            require(
                _verifySignature(fid, msg.sender, username, deadline, signature),
                "Invalid signature"
            );
        }

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
        totalSupply++;

        _safeMint(msg.sender, fid);
        emit Minted(fid, msg.sender, username);
    }

    // ── Signature verification ─────────────────────────────────

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
    //  PALETTES — pure functions, zero storage reads
    // ═══════════════════════════════════════════════════════════

    function _bgColor(uint256 i) internal pure returns (string memory) {
        if (i == 0) return "#05050F";
        if (i == 1) return "#0A0500";
        if (i == 2) return "#00080A";
        if (i == 3) return "#0A0005";
        if (i == 4) return "#00050A";
        if (i == 5) return "#080005";
        if (i == 6) return "#050A00";
        return "#08080A";
    }

    function _accentColor(uint256 i) internal pure returns (string memory) {
        if (i == 0) return "#39FF14";
        if (i == 1) return "#FF6B00";
        if (i == 2) return "#00CFFF";
        if (i == 3) return "#FF2DF7";
        if (i == 4) return "#FFD700";
        if (i == 5) return "#00FFA3";
        if (i == 6) return "#FF3860";
        return "#B4FF39";
    }

    function _dimColor(uint256 i) internal pure returns (string memory) {
        if (i == 0) return "#1A6B0A";
        if (i == 1) return "#6B2F00";
        if (i == 2) return "#005A6B";
        if (i == 3) return "#6B006B";
        if (i == 4) return "#6B5A00";
        if (i == 5) return "#006B44";
        if (i == 6) return "#6B0A1A";
        return "#4A6B00";
    }

    function _opacity(uint256 i) internal pure returns (string memory) {
        if (i == 0) return "0.08";
        if (i == 1) return "0.14";
        if (i == 2) return "0.22";
        if (i == 3) return "0.34";
        if (i == 4) return "0.50";
        return "0.68";
    }

    // ═══════════════════════════════════════════════════════════
    //  TRIG — pure functions, zero storage reads
    //  cos/sin × 1000, 6 rotation variants × 3 vertices
    // ═══════════════════════════════════════════════════════════

    function _triCos(uint256 rot, uint256 v) internal pure returns (int256) {
        if (rot == 0) { if (v == 0) return  1000; if (v == 1) return  -500; return  -500; }
        if (rot == 1) { if (v == 0) return   866; if (v == 1) return  -866; return     0; }
        if (rot == 2) { if (v == 0) return   500; if (v == 1) return -1000; return   500; }
        if (rot == 3) { if (v == 0) return     0; if (v == 1) return  -866; return   866; }
        if (rot == 4) { if (v == 0) return  -500; if (v == 1) return  -500; return  1000; }
                       if (v == 0) return  -866; if (v == 1) return     0; return   866;
    }

    function _triSin(uint256 rot, uint256 v) internal pure returns (int256) {
        if (rot == 0) { if (v == 0) return     0; if (v == 1) return   866; return  -866; }
        if (rot == 1) { if (v == 0) return   500; if (v == 1) return   500; return -1000; }
        if (rot == 2) { if (v == 0) return   866; if (v == 1) return     0; return  -866; }
        if (rot == 3) { if (v == 0) return  1000; if (v == 1) return  -500; return  -500; }
        if (rot == 4) { if (v == 0) return   866; if (v == 1) return  -866; return     0; }
                       if (v == 0) return   500; if (v == 1) return -1000; return   500;
    }

    // ═══════════════════════════════════════════════════════════
    //  RNG + UTILS
    // ═══════════════════════════════════════════════════════════

    function _rng(uint256 seed, uint256 nonce, uint256 mod) internal pure returns (uint256) {
        return uint256(keccak256(abi.encodePacked(seed, nonce))) % mod;
    }

    function _itoa(int256 v) internal pure returns (string memory) {
        if (v >= 0) return uint256(v).toString();
        return string(abi.encodePacked("-", uint256(-v).toString()));
    }

    // ═══════════════════════════════════════════════════════════
    //  SVG LAYERS
    // ═══════════════════════════════════════════════════════════

    function _buildGlow(uint256 seed, string memory ac, string memory dim)
        internal pure returns (string memory s)
    {
        s = "";
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
    }

    function _buildCircles(uint256 seed, uint256 count, string memory ac, string memory dim)
        internal pure returns (string memory s)
    {
        s = "";
        for (uint256 i = 0; i < count; i++) {
            uint256 cx    = _rng(seed, 100 + i * 6, 430) + 35;
            uint256 cy    = _rng(seed, 101 + i * 6, 370) + 65;
            uint256 r     = _rng(seed, 102 + i * 6, 28)  + 5;
            string memory op    = _opacity(_rng(seed, 103 + i * 6, 6));
            string memory color = _rng(seed, 104 + i * 6, 3) == 0 ? dim : ac;
            if (_rng(seed, 105 + i * 6, 2) == 0) {
                s = string(abi.encodePacked(s,
                    '<circle cx="', cx.toString(), '" cy="', cy.toString(),
                    '" r="', r.toString(), '" fill="', color, '" opacity="', op, '"/>'));
            } else {
                s = string(abi.encodePacked(s,
                    '<circle cx="', cx.toString(), '" cy="', cy.toString(),
                    '" r="', r.toString(), '" fill="none" stroke="', color,
                    '" stroke-width="0.9" opacity="', op, '"/>'));
            }
        }
    }

    function _buildRects(uint256 seed, uint256 count, string memory ac, string memory dim)
        internal pure returns (string memory s)
    {
        s = "";
        for (uint256 i = 0; i < count; i++) {
            s = _appendRect(s, seed, i, ac, dim);
        }
    }

    function _appendRect(
        string memory s, uint256 seed, uint256 i,
        string memory ac, string memory dim
    ) internal pure returns (string memory) {
        string memory color = _rng(seed, 105 + i * 7, 3) == 0 ? dim : ac;
        string memory op    = _opacity(_rng(seed, 104 + i * 7, 6));
        string memory geo   = string(abi.encodePacked(
            '<rect x="',  (_rng(seed, 100 + i * 7, 400) + 20).toString(),
            '" y="',      (_rng(seed, 101 + i * 7, 360) + 50).toString(),
            '" width="',  (_rng(seed, 102 + i * 7, 60)  + 12).toString(),
            '" height="', (_rng(seed, 103 + i * 7, 60)  + 12).toString(),
            '" rx="', _rng(seed, 107 + i * 7, 3) == 0 ? "2" : "0", '"'
        ));
        if (_rng(seed, 106 + i * 7, 2) == 0) {
            return string(abi.encodePacked(s, geo, ' fill="', color, '" opacity="', op, '"/>'));
        }
        return string(abi.encodePacked(s, geo, ' fill="none" stroke="', color, '" stroke-width="0.9" opacity="', op, '"/>'));
    }

    function _buildTriangles(uint256 seed, uint256 count, string memory ac, string memory dim)
        internal pure returns (string memory s)
    {
        s = "";
        for (uint256 i = 0; i < count; i++) {
            uint256 cx   = _rng(seed, 100 + i * 7, 420) + 40;
            uint256 cy   = _rng(seed, 101 + i * 7, 360) + 70;
            uint256 r    = _rng(seed, 102 + i * 7, 30)  + 8;
            string memory op    = _opacity(_rng(seed, 103 + i * 7, 6));
            string memory color = _rng(seed, 104 + i * 7, 3) == 0 ? dim : ac;
            uint256 rot  = _rng(seed, 106 + i * 7, 6);
            string memory pts   = _trianglePoints(cx, cy, r, rot);
            if (_rng(seed, 105 + i * 7, 2) == 0) {
                s = string(abi.encodePacked(s,
                    '<polygon points="', pts, '" fill="', color, '" opacity="', op, '"/>'));
            } else {
                s = string(abi.encodePacked(s,
                    '<polygon points="', pts, '" fill="none" stroke="', color,
                    '" stroke-width="0.9" opacity="', op, '"/>'));
            }
        }
    }

    function _trianglePoints(uint256 cx, uint256 cy, uint256 r, uint256 rot)
        internal pure returns (string memory pts)
    {
        pts = "";
        for (uint256 v = 0; v < 3; v++) {
            int256 px = int256(cx) + (_triCos(rot, v) * int256(r)) / 1000;
            int256 py = int256(cy) + (_triSin(rot, v) * int256(r)) / 1000;
            pts = string(abi.encodePacked(pts, _itoa(px), ",", _itoa(py), " "));
        }
    }

    function _buildTrail(uint256 seed, string memory ac)
        internal pure returns (string memory)
    {
        string memory pts  = "";
        string memory dots = "";
        for (uint256 i = 0; i < 9; i++) {
            uint256 x = _rng(seed, 300 + i * 2, 420) + 40;
            uint256 y = _rng(seed, 301 + i * 2, 360) + 70;
            pts  = string(abi.encodePacked(pts, x.toString(), ",", y.toString(), " "));
            dots = string(abi.encodePacked(dots,
                '<circle cx="', x.toString(), '" cy="', y.toString(),
                '" r="3" fill="', ac, '" opacity="0.7"/>'));
        }
        return string(abi.encodePacked(
            '<polyline points="', pts, '" fill="none" stroke="', ac,
            '" stroke-width="1.2" stroke-opacity="0.25" stroke-dasharray="5 5"/>',
            dots
        ));
    }

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
            ac, '" text-anchor="middle" opacity="0.80">#', fid.toString(), '</text>'
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

    // ═══════════════════════════════════════════════════════════
    //  SVG ROOT BUILDER
    // ═══════════════════════════════════════════════════════════

    function _buildSVG(uint256 fid, uint256 seed, string memory username)
        internal pure returns (string memory)
    {
        string memory bg  = _bgColor(_rng(seed, 0, 8));
        string memory ac  = _accentColor(_rng(seed, 1, 8));
        string memory dim = _dimColor(_rng(seed, 2, 8));

        uint256 shapeType = _rng(seed, 99, 3);
        uint256 tier      = _rng(seed, 98, 3);
        uint256 count     = tier == 0
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

    // ═══════════════════════════════════════════════════════════
    //  TOKEN URI
    // ═══════════════════════════════════════════════════════════

    function tokenURI(uint256 tokenId) public view override returns (string memory) {
        require(_ownerOf(tokenId) != address(0), "Token does not exist");
        TokenData memory d = _tokenData[tokenId];
        return string(abi.encodePacked(
            "data:application/json;base64,",
            Base64.encode(bytes(_buildJSON(tokenId, d)))
        ));
    }

    function _buildJSON(uint256 tokenId, TokenData memory d)
        internal pure returns (string memory)
    {
        string memory image = string(abi.encodePacked(
            "data:image/svg+xml;base64,",
            Base64.encode(bytes(_buildSVG(tokenId, d.seed, d.username)))
        ));
        string memory attrs = string(abi.encodePacked(
            '{"trait_type":"FID","value":', tokenId.toString(), '},',
            '{"trait_type":"Username","value":"', d.username, '"}',
            ',{"trait_type":"Type","value":"OG"}',
            ',{"trait_type":"Mint Timestamp","display_type":"date","value":',
            d.mintTimestamp.toString(), '}'
        ));
        return string(abi.encodePacked(
            '{"name":"Steps OG #', tokenId.toString(),
            '","description":"The original Steps community. Steps is a fitness app that rewards active people on Base and Farcaster.",',
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
