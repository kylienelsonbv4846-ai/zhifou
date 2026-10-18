import { createContext, useCallback, useContext, useMemo, useState, ReactNode } from 'react';

const PENDING_EMAIL_KEY = 'classclicker.pending-registration-email';

interface RegistrationData {
  email: string;
}

interface RegistrationContextType {
  registrationData: RegistrationData | null;
  setRegistrationData: (data: RegistrationData) => void;
  clearRegistrationData: () => void;
}

function readPendingEmail(): RegistrationData | null {
  if (typeof window === 'undefined') return null;
  try {
    const email = window.sessionStorage.getItem(PENDING_EMAIL_KEY)?.trim().toLowerCase();
    return email ? { email } : null;
  } catch {
    return null;
  }
}

const RegistrationContext = createContext<RegistrationContextType | undefined>(undefined);

export function RegistrationProvider({ children }: { children: ReactNode }) {
  const [registrationData, setRegistrationData] = useState<RegistrationData | null>(readPendingEmail);

  const handleSetRegistrationData = useCallback((data: RegistrationData) => {
    const email = data.email.trim().toLowerCase();
    if (typeof window !== 'undefined') {
      try {
        if (email) window.sessionStorage.setItem(PENDING_EMAIL_KEY, email);
        else window.sessionStorage.removeItem(PENDING_EMAIL_KEY);
      } catch {
        // In-memory state still supports the flow in restricted browsers.
      }
    }
    setRegistrationData(email ? { email } : null);
  }, []);

  const handleClearRegistrationData = useCallback(() => {
    if (typeof window !== 'undefined') {
      try {
        window.sessionStorage.removeItem(PENDING_EMAIL_KEY);
      } catch {
        // In-memory state can still be cleared if storage is unavailable.
      }
    }
    setRegistrationData(null);
  }, []);

  const value = useMemo(() => ({
    registrationData,
    setRegistrationData: handleSetRegistrationData,
    clearRegistrationData: handleClearRegistrationData,
  }), [registrationData, handleSetRegistrationData, handleClearRegistrationData]);

  return (
    <RegistrationContext.Provider value={value}>
      {children}
    </RegistrationContext.Provider>
  );
}

export function useRegistration() {
  const context = useContext(RegistrationContext);
  if (context === undefined) {
    throw new Error('useRegistration must be used within RegistrationProvider');
  }
  return context;
}
