// Lista de FIDs autorizados para la zona de pruebas
export const AUTHORIZED_TEST_FIDS = [20701, 1020677];

// Función para verificar si un FID está autorizado
export const isAuthorizedForTesting = (fid: number | null | undefined): boolean => {
  if (!fid) return false;
  return AUTHORIZED_TEST_FIDS.includes(fid);
}; 