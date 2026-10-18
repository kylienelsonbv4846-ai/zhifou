import { useEffect } from "react";
import { useLocation } from "wouter";
import { Loader2 } from "lucide-react";
import { useRegistration } from "@/contexts/RegistrationContext";

export default function VerifyEmailPending() {
  const [, setLocation] = useLocation();
  const { registrationData } = useRegistration();

  useEffect(() => {
    if (registrationData?.email) {
      setLocation(`/verify-email?email=${encodeURIComponent(registrationData.email)}`);
    } else {
      setLocation("/register");
    }
  }, [registrationData?.email, setLocation]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100 p-4">
      <div className="flex items-center gap-3 rounded-lg bg-white p-6 shadow-lg">
        <Loader2 className="h-5 w-5 animate-spin text-blue-600" />
        <p className="text-sm text-gray-600">正在打开邮箱验证码页面…</p>
      </div>
    </div>
  );
}
