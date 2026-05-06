import { useState, useEffect } from 'react';
// Ajusta la ruta de apiFetch si tu alias "@" no está configurado o apunta a otro lado
import { apiFetch } from '../lib/api'; 

export function useMarketingApi<T>(endpoint: string) {
  const [data, setData] = useState<T[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchData = async () => {
    setIsLoading(true);
    try {
      const res = await apiFetch(`/api/marketing/${endpoint}`);
      if (!res.ok) throw new Error('Error al cargar datos');
      const json = await res.json();
      setData(json);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [endpoint]);

  // Exponemos setData por si tus formularios necesitan actualizar el estado local temporalmente
  return { data, setData, isLoading, error, refetch: fetchData };
}



