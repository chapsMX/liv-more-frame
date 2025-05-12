// Mock for react-native Platform and other required exports
export const Platform = {
  OS: 'web',
  select: (obj: { [key: string]: any }) => obj.web || obj.default || null,
};

export const AppState = {
  currentState: 'active',
  addEventListener: () => ({ remove: () => {} }),
  removeEventListener: () => {},
};

export const NativeModules = {
  RookSdkAppleHealth: {
    // Mock methods that might be called
    configure: async () => {},
    connect: async () => {},
    disconnect: async () => {},
    syncData: async () => {},
    getUserId: async () => null,
    getLastSync: async () => null,
    clearUserData: async () => {},
  },
  RookSyncModule: {
    // Mock methods for Android sync module
    configure: async () => {},
    connect: async () => {},
    disconnect: async () => {},
    syncData: async () => {},
    getUserId: async () => null,
    getLastSync: async () => null,
    clearUserData: async () => {},
  }
};

// Add other react-native mocks as needed
export default {
  Platform,
  AppState,
  NativeModules,
}; 