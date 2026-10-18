import { useState } from "react";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import { Loader2, Eye, EyeOff, AlertCircle, CheckCircle2, Info } from "lucide-react";
import { useAuth } from "@/_core/hooks/useAuth";

// 验证规则
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// 验证邮箱
const validateEmail = (email: string): string | null => {
  if (!email.trim()) {
    return "邮箱不能为空";
  }
  if (!EMAIL_REGEX.test(email)) {
    return "邮箱格式不正确";
  }
  return null;
};

// 验证密码
const validatePassword = (password: string): string | null => {
  if (!password) {
    return "密码不能为空";
  }
  return null;
};

export default function Login() {
  const [, setLocation] = useLocation();
  const [formData, setFormData] = useState({
    email: "",
    password: "",
    rememberMe: false,
  });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [touched, setTouched] = useState<Record<string, boolean>>({});
  const [isLoading, setIsLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [loginError, setLoginError] = useState<string | null>(null);

  const { refresh: refreshAuth } = useAuth();

  const loginMutation = trpc.auth.login.useMutation({
    onSuccess: async () => {
      toast.success("登录成功");
      setLoginError(null);
      await refreshAuth();
      setLocation("/dashboard");
    },
    onError: (error) => {
      const errorMessage = error.message || "登录失败，请重试";
      setLoginError(errorMessage);
      toast.error(errorMessage);
    },
    onSettled: () => {
      setIsLoading(false);
    },
  });

  const validateForm = (): boolean => {
    const newErrors: Record<string, string> = {};

    const emailError = validateEmail(formData.email);
    if (emailError) {
      newErrors.email = emailError;
    }

    const passwordError = validatePassword(formData.password);
    if (passwordError) {
      newErrors.password = passwordError;
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setLoginError(null);

    // 检查HTML5验证
    const form = e.currentTarget as HTMLFormElement;
    if (!form.checkValidity()) {
      form.reportValidity();
      return;
    }

    if (!validateForm()) {
      return;
    }

    setIsLoading(true);
    loginMutation.mutate({
      email: formData.email.toLowerCase().trim(),
      password: formData.password,
    });
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: value,
    }));
    // 清除该字段的错误信息
    if (errors[name]) {
      setErrors((prev) => ({
        ...prev,
        [name]: "",
      }));
    }
    // 清除登录错误
    if (loginError) {
      setLoginError(null);
    }
  };

  const handleBlur = (field: string) => {
    setTouched((prev) => ({
      ...prev,
      [field]: true,
    }));

    // 实时验证
    let error: string | null = null;
    if (field === "email") {
      error = validateEmail(formData.email);
    } else if (field === "password") {
      error = validatePassword(formData.password);
    }

    if (error) {
      setErrors((prev) => ({
        ...prev,
        [field]: error,
      }));
    } else {
      setErrors((prev) => ({
        ...prev,
        [field]: "",
      }));
    }
  };

  const emailIsValid = !validateEmail(formData.email) && formData.email.length > 0;
  const passwordIsValid = !validatePassword(formData.password) && formData.password.length > 0;

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center p-4">
      <Card className="w-full max-w-md shadow-lg">
        <CardHeader className="space-y-2">
          <CardTitle className="text-2xl">登录</CardTitle>
          <CardDescription>
            登录您的ClassClicker账户
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4" noValidate>
            {/* 登录错误提示 */}
            {loginError && (
              <div className="bg-red-50 border border-red-200 rounded-lg p-3 flex gap-3">
                <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
                <div className="flex-1">
                  <p className="text-sm font-medium text-red-800">登录失败</p>
                  <p className="text-sm text-red-700 mt-0.5">{loginError}</p>
                </div>
              </div>
            )}

            {/* 邮箱输入框 */}
            <div className="space-y-2">
              <label htmlFor="email" className="text-sm font-medium">
                邮箱
              </label>
              <div className="relative">
                <Input
                  id="email"
                  name="email"
                  type="email"
                  placeholder="请输入您的邮箱"
                  value={formData.email}
                  onChange={handleInputChange}
                  onBlur={() => handleBlur("email")}
                  disabled={isLoading}
                  required
                  title="请输入有效的邮箱地址"
                  className={`${
                    touched.email && !errors.email && formData.email
                      ? "border-green-500"
                      : errors.email
                      ? "border-red-500"
                      : ""
                  }`}
                />
                {touched.email && !errors.email && formData.email && (
                  <CheckCircle2 className="absolute right-3 top-1/2 -translate-y-1/2 w-5 h-5 text-green-500" />
                )}
              </div>
              {errors.email && (
                <div className="flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 text-red-500 flex-shrink-0" />
                  <p className="text-sm text-red-500">{errors.email}</p>
                </div>
              )}
              {touched.email && !errors.email && formData.email && (
                <p className="text-sm text-green-600 flex items-center gap-1">
                  <CheckCircle2 className="w-4 h-4" />
                  邮箱格式正确
                </p>
              )}
            </div>

            {/* 密码输入框 */}
            <div className="space-y-2">
              <label htmlFor="password" className="text-sm font-medium">
                密码
              </label>
              <div className="relative">
                <Input
                  id="password"
                  name="password"
                  type={showPassword ? "text" : "password"}
                  placeholder="请输入密码"
                  value={formData.password}
                  onChange={handleInputChange}
                  onBlur={() => handleBlur("password")}
                  disabled={isLoading}
                  required
                  title="请输入密码"
                  className={`pr-10 ${
                    passwordIsValid && touched.password
                      ? "border-green-500"
                      : errors.password
                      ? "border-red-500"
                      : ""
                  }`}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  disabled={isLoading}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-700 disabled:opacity-50 transition-colors"
                >
                  {showPassword ? (
                    <EyeOff className="w-4 h-4" />
                  ) : (
                    <Eye className="w-4 h-4" />
                  )}
                </button>
              </div>
              {errors.password && (
                <div className="flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 text-red-500 flex-shrink-0" />
                  <p className="text-sm text-red-500">{errors.password}</p>
                </div>
              )}
              {touched.password && !errors.password && formData.password && (
                <p className="text-sm text-green-600 flex items-center gap-1">
                  <CheckCircle2 className="w-4 h-4" />
                  密码已输入
                </p>
              )}
            </div>

            {/* 记住我复选框 */}
            <div className="flex items-center space-x-2">
              <input
                id="rememberMe"
                type="checkbox"
                checked={formData.rememberMe}
                onChange={(e) => setFormData(prev => ({ ...prev, rememberMe: e.target.checked }))}
                disabled={isLoading}
                className="w-4 h-4 rounded border-gray-300 cursor-pointer"
              />
              <label htmlFor="rememberMe" className="text-sm text-gray-700 cursor-pointer">
                记住我
              </label>
            </div>

            {/* 提交按钮 */}
            <Button
              type="submit"
              className="w-full bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700"
              disabled={isLoading || !emailIsValid || !passwordIsValid}
            >
              {isLoading ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  登录中...
                </>
              ) : (
                "登录"
              )}
            </Button>

            {/* 帮助提示 */}
            {loginError && (
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 flex gap-3">
                <Info className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
                <div className="flex-1">
                  <p className="text-sm text-blue-800">
                    如果您忘记了密码，可以点击下方的"忘记密码？"进行重置。
                  </p>
                </div>
              </div>
            )}

            {/* 忘记密码链接 */}
            <div className="text-center text-sm">
              <button
                type="button"
                onClick={() => setLocation("/forgot-password")}
                className="text-blue-600 hover:text-blue-700 font-medium transition-colors"
                disabled={isLoading}
              >
                忘记密码？
              </button>
            </div>

            {/* 注册链接 */}
            <div className="text-center text-sm">
              <span className="text-gray-600">还没有账户？</span>
              <button
                type="button"
                onClick={() => setLocation("/register")}
                className="text-blue-600 hover:text-blue-700 font-medium ml-1 transition-colors"
                disabled={isLoading}
              >
                注册
              </button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
