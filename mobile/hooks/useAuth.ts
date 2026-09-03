import { useEffect, useState } from "react";
import { storage } from "@/lib/storage";

export function useAuth() {
  const [accessToken, setAccessToken] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    storage.getAccessToken().then((token) => {
      setAccessToken(token);
      setLoading(false);
    });
  }, []);

  return {
    accessToken,
    isAuthenticated: !!accessToken,
    loading,
  };
}
