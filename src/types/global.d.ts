import { EthereumProvider } from 'ethers';

interface Window {
  ethereum: EthereumProvider;
}

declare global {
  interface Window {
    ethereum: EthereumProvider;
  }
} 