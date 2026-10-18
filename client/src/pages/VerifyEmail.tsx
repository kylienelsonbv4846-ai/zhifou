import { useEffect, useRef, useState } from "react";
import { useLocation, useSearch } from "wouter";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import { AlertCircle, CheckCircle2, Clock, Loader2, Mail } from "lucide-react";
import { useRegistration } from "@/contexts/RegistrationContext";

type VerificationStatus = "input" | "loading" | "success" | "error" | "expired";

export default function VerifyEmail() {
  const [, setLocation] = useLocation();
  const search = useSearch();
  const queryEmail = new URLSearchParams(search).get("email")?.trim().toLowerCase() || "";
  const legacyToken = new URLSearchParams(search).get("token")?.trim() || "";
  const initialLegacyToken = useRef(legacyToken);
  const activeLegacyToken = legacyToken || initialLegacyToken.current;
  const { registrationData, setRegistrationData, clearRegistrationData } = useRegistration();
  const [email, setEmail] = useState(registrationData?.email || queryEmail);
  const [status, setStatus] = useState<VerificationStatus>("input");
  const [code, setCode] = useState("");
  const [message, setMessage] = useState("");
  const [resendCooldown, setResendCooldown] = useState(0);
  const legacyTokenStarted = useRef(false);

  useEffect(() => {
    if (activeLegacyToken) return;
    const pendingEmail = registrationData?.email || queryEmail;
    if (pendingEmail) {
      setEmail(pendingEmail);
      if (registrationData?.email !== pendingEmail) {
        setRegistrationData({ email: pendingEmail });
      }
      return;
    }
    toast.error("请先完成注册步骤");
    setLocation("/register");
  }, [activeLegacyToken, queryEmail, registrationData?.email, setLocation, setRegistrationData]);

  useEffect(() => {
    if (resendCooldown <= 0) return;
    const timer = window.setTimeout(() => {
      setResendCooldown((remaining) => Math.max(0, remaining - 1));
    }, 1000);
    return () => window.clearTimeout(timer);
  }, [resendCooldown]);

  const verifyEmailMutation = trpc.auth.verifyEmail.useMutation({
    onSuccess: () => {
      setStatus("success");
      setMessage("邮箱验证成功，现在可以登录 ClassClicker。");
      toast.success("邮箱验证成功，您现在可以登录了");
      clearRegistrationData();
      window.setTimeout(() => setLocation("/login"), 2000);
    },
    onError: (error) => {
      const errorMessage = error.message || "验证失败，请重试";
      setStatus(errorMessage.includes("过期") ? "expired" : "error");
      setMessage(errorMessage);
      toast.error(errorMessage);
    },
  });

  const verifyEmailTokenMutation = trpc.auth.verifyEmailToken.useMutation({
    onSuccess: () => {
      setStatus("success");
      setMessage("邮箱验证成功，现在可以登录 ClassClicker。");
      toast.success("邮箱验证成功，您现在可以登录了");
      clearRegistrationData();
      window.setTimeout(() => setLocation("/login"), 2000);
    },
    onError: (error) => {
      const errorMessage = error.message || "验证链接无效，请重新发送验证邮件";
      setStatus("error");
      setMessage(errorMessage);
      toast.error(errorMessage);
    },
  });

  useEffect(() => {
    if (!activeLegacyToken || legacyTokenStarted.current) return;
    legacyTokenStarted.current = true;
    const currentUrl = new URL(window.location.href);
    currentUrl.searchParams.delete("token");
    window.history.replaceState({}, "", `${currentUrl.pathname}${currentUrl.search}${currentUrl.hash}`);
    setStatus("loading");
    verifyEmailTokenMutation.mutate({ token: activeLegacyToken });
  }, [activeLegacyToken, verifyEmailTokenMutation.mutate]);

  const resendMutation = trpc.auth.resendVerificationEmail.useMutation({
    onSuccess: (result) => {
      setResendCooldown(result.remainingSeconds || 300);
      toast.info(result.message);
    },
    onError: (error) => toast.error(error.message || "发送失败，请稍后重试"),
  });

  const handleSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!email) {
      toast.error("邮箱地址缺失，请重新注册");
      setLocation("/register");
      return;
    }
    if (!/^[A-Z0-9]{6}$/.test(code)) {
      toast.error("请输入邮件中的6位字母/数字验证码");
      return;
    }
    setStatus("loading");
    verifyEmailMutation.mutate({ email, code });
  };

  const handleCodeChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const value = event.target.value.toUpperCase();
    if (/^[A-Z0-9]*$/.test(value) && value.length <= 6) setCode(value);
  };

  const handleResend = () => {
    if (!email || resendCooldown > 0 || resendMutation.isPending) return;
    resendMutation.mutate({ email });
  };

  if (activeLegacyToken) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center p-4">
        <Card className="w-full max-w-md shadow-lg">
          <CardHeader className="space-y-2">
            <div className="flex justify-center mb-2"><Mail className="w-10 h-10 text-blue-600" /></div>
            <CardTitle className="text-2xl text-center">邮箱验证</CardTitle>
            <CardDescription className="text-center">正在处理此前发送的邮箱验证链接。</CardDescription>
          </CardHeader>
          <CardContent className="space-y-5">
            {status === "loading" && (
              <div className="flex flex-col items-center justify-center space-y-4 py-8">
                <Loader2 className="h-12 w-12 animate-spin text-blue-600" />
                <p className="text-center text-gray-600">正在验证邮箱…</p>
              </div>
            )}
            {status === "success" && (
              <div className="flex flex-col items-center justify-center space-y-4 py-8">
                <CheckCircle2 className="h-12 w-12 text-green-600" />
                <p className="text-center text-gray-700">{message}</p>
                <Button onClick={() => setLocation("/login")} className="w-full">立即登录</Button>
              </div>
            )}
            {status === "error" && (
              <div className="space-y-4">
                <div className="flex items-start gap-2 rounded-md border border-amber-200 bg-amber-50 p-3">
                  <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-amber-700" />
                  <p className="text-sm text-amber-800">{message}</p>
                </div>
                <Button onClick={() => setLocation("/login")} variant="outline" className="w-full">返回登录</Button>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!email) return null;

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center p-4">
      <Card className="w-full max-w-md shadow-lg">
        <CardHeader className="space-y-2">
          <div className="flex justify-center mb-2">
            <Mail className="w-10 h-10 text-blue-600" />
          </div>
          <CardTitle className="text-2xl text-center">邮箱验证</CardTitle>
          <CardDescription className="text-center">
            验证码已发送至 <strong>{email}</strong>。请输入邮件中的6位验证码。
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-5">
          {status === "input" || status === "error" || status === "expired" ? (
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <label htmlFor="verification-code" className="text-sm font-medium">验证码</label>
                <Input
                  id="verification-code"
                  type="text"
                  placeholder="输入6位验证码"
                  value={code}
                  onChange={handleCodeChange}
                  disabled={verifyEmailMutation.isPending}
                  maxLength={6}
                  autoComplete="one-time-code"
                  inputMode="text"
                  className="text-center text-lg tracking-widest font-mono"
                  autoFocus
                />
                <p className="text-xs text-gray-500">验证码由字母和数字组成，10分钟内有效。</p>
              </div>

              {(status === "error" || status === "expired") && (
                <div className="flex items-start gap-2 rounded-md border border-amber-200 bg-amber-50 p-3">
                  <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-amber-700" />
                  <p className="text-sm text-amber-800">{message}</p>
                </div>
              )}

              <Button type="submit" className="w-full" disabled={code.length !== 6 || verifyEmailMutation.isPending}>
                {verifyEmailMutation.isPending ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />正在验证…</> : "验证邮箱"}
              </Button>
            </form>
          ) : null}

          {status === "loading" && (
            <div className="flex flex-col items-center justify-center space-y-4 py-8">
              <Loader2 className="h-12 w-12 animate-spin text-blue-600" />
              <p className="text-center text-gray-600">正在验证验证码…</p>
            </div>
          )}

          {status === "success" && (
            <div className="flex flex-col items-center justify-center space-y-4 py-8">
              <CheckCircle2 className="h-12 w-12 text-green-600" />
              <p className="text-center text-gray-700">{message}</p>
              <Button onClick={() => setLocation("/login")} className="w-full">立即登录</Button>
            </div>
          )}

          {status !== "success" && status !== "loading" && (
            <div className="space-y-3">
              <Button
                type="button"
                variant="outline"
                className="w-full"
                onClick={handleResend}
                disabled={resendCooldown > 0 || resendMutation.isPending}
              >
                {resendMutation.isPending ? (
                  <><Loader2 className="mr-2 h-4 w-4 animate-spin" />正在发送…</>
                ) : resendCooldown > 0 ? (
                  <><Clock className="mr-2 h-4 w-4" />{Math.floor(resendCooldown / 60)}:{String(resendCooldown % 60).padStart(2, "0")} 后可重发</>
                ) : (
                  "重新发送验证码"
                )}
              </Button>
              <div className="text-center text-sm">
                <button type="button" onClick={() => { clearRegistrationData(); setLocation("/register"); }} className="font-medium text-blue-600 hover:text-blue-700">
                  需要使用其他邮箱？重新注册
                </button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
