# OAuth代码实现参考

本文档包含所有OAuth集成所需的完整代码实现。

## 目录

- [后端服务代码](#后端服务代码)
- [后端路由代码](#后端路由代码)
- [前端组件代码](#前端组件代码)
- [数据库辅助函数](#数据库辅助函数)
- [工具函数](#工具函数)

---

## 后端服务代码

### QQ OAuth服务 (`server/oauth/qq.ts`)

```typescript
import axios from 'axios';

const QQ_AUTHORIZE_URL = 'https://graph.qq.com/oauth2.0/authorize';
const QQ_TOKEN_URL = 'https://graph.qq.com/oauth2.0/token';
const QQ_OPENID_URL = 'https://graph.qq.com/oauth2.0/me';
const QQ_USERINFO_URL = 'https://graph.qq.com/user/get_user_info';

export interface QQUserInfo {
  openid: string;
  nickname: string;
  figureurl: string;
  gender: string;
  province: string;
  city: string;
}

export interface QQTokenResponse {
  access_token: string;
  expires_in: number;
  refresh_token: string;
}

/**
 * 生成QQ授权URL
 */
export function generateQQAuthUrl(state: string): string {
  const params = new URLSearchParams({
    client_id: process.env.QQ_APP_ID || '',
    response_type: 'code',
    scope: 'get_user_info',
    redirect_uri: process.env.QQ_REDIRECT_URI || '',
    state,
  });
  return `${QQ_AUTHORIZE_URL}?${params.toString()}`;
}

/**
 * 用授权码换取access_token
 */
export async function exchangeQQCode(code: string): Promise<QQTokenResponse> {
  try {
    const response = await axios.get(QQ_TOKEN_URL, {
      params: {
        client_id: process.env.QQ_APP_ID,
        client_secret: process.env.QQ_APP_KEY,
        code,
        grant_type: 'authorization_code',
        redirect_uri: process.env.QQ_REDIRECT_URI,
      },
    });

    // QQ返回的是URL编码格式，需要解析
    const data = new URLSearchParams(response.data);
    return {
      access_token: data.get('access_token') || '',
      expires_in: parseInt(data.get('expires_in') || '0'),
      refresh_token: data.get('refresh_token') || '',
    };
  } catch (error) {
    console.error('Failed to exchange QQ code:', error);
    throw new Error('Failed to exchange QQ authorization code');
  }
}

/**
 * 用access_token获取用户OpenID
 */
export async function getQQOpenID(accessToken: string): Promise<string> {
  try {
    const response = await axios.get(QQ_OPENID_URL, {
      params: {
        access_token: accessToken,
        fmt: 'json',
      },
    });

    return response.data.openid;
  } catch (error) {
    console.error('Failed to get QQ OpenID:', error);
    throw new Error('Failed to get QQ OpenID');
  }
}

/**
 * 用access_token和OpenID获取用户信息
 */
export async function getQQUserInfo(
  accessToken: string,
  openid: string
): Promise<QQUserInfo> {
  try {
    const response = await axios.get(QQ_USERINFO_URL, {
      params: {
        access_token: accessToken,
        oauth_consumer_key: process.env.QQ_APP_ID,
        openid,
      },
    });

    if (response.data.ret !== 0) {
      throw new Error(`QQ API error: ${response.data.msg}`);
    }

    return {
      openid,
      nickname: response.data.nickname,
      figureurl: response.data.figureurl_2 || response.data.figureurl,
      gender: response.data.gender,
      province: response.data.province,
      city: response.data.city,
    };
  } catch (error) {
    console.error('Failed to get QQ user info:', error);
    throw new Error('Failed to get QQ user information');
  }
}

/**
 * 刷新QQ access_token
 */
export async function refreshQQToken(
  refreshToken: string
): Promise<QQTokenResponse> {
  try {
    const response = await axios.get(QQ_TOKEN_URL, {
      params: {
        client_id: process.env.QQ_APP_ID,
        client_secret: process.env.QQ_APP_KEY,
        refresh_token: refreshToken,
        grant_type: 'refresh_token',
      },
    });

    const data = new URLSearchParams(response.data);
    return {
      access_token: data.get('access_token') || '',
      expires_in: parseInt(data.get('expires_in') || '0'),
      refresh_token: data.get('refresh_token') || '',
    };
  } catch (error) {
    console.error('Failed to refresh QQ token:', error);
    throw new Error('Failed to refresh QQ access token');
  }
}
```

### 抖音OAuth服务 (`server/oauth/douyin.ts`)

```typescript
import axios from 'axios';

const DOUYIN_AUTHORIZE_URL = 'https://open.douyin.com/platform/oauth/connect';
const DOUYIN_TOKEN_URL = 'https://open.douyin.com/oauth/access_token/';
const DOUYIN_USERINFO_URL = 'https://open.douyin.com/oauth/userinfo/';

export interface DouyinUserInfo {
  open_id: string;
  union_id: string;
  nickname: string;
  avatar: string;
  gender: number;
  province: string;
  city: string;
}

export interface DouyinTokenResponse {
  access_token: string;
  expires_in: number;
  refresh_token: string;
  refresh_expires_in: number;
  scope: string;
  token_type: string;
}

/**
 * 生成抖音授权URL
 */
export function generateDouyinAuthUrl(state: string): string {
  const params = new URLSearchParams({
    client_key: process.env.DOUYIN_CLIENT_KEY || '',
    response_type: 'code',
    scope: 'user.info.basic',
    redirect_uri: process.env.DOUYIN_REDIRECT_URI || '',
    state,
  });
  return `${DOUYIN_AUTHORIZE_URL}?${params.toString()}`;
}

/**
 * 用授权码换取access_token
 */
export async function exchangeDouyinCode(
  code: string
): Promise<DouyinTokenResponse> {
  try {
    const response = await axios.post(DOUYIN_TOKEN_URL, {
      client_key: process.env.DOUYIN_CLIENT_KEY,
      client_secret: process.env.DOUYIN_CLIENT_SECRET,
      code,
      grant_type: 'authorization_code',
    });

    if (response.data.status_code !== 0) {
      throw new Error(`Douyin API error: ${response.data.message}`);
    }

    return response.data.data;
  } catch (error) {
    console.error('Failed to exchange Douyin code:', error);
    throw new Error('Failed to exchange Douyin authorization code');
  }
}

/**
 * 用access_token获取用户信息
 */
export async function getDouyinUserInfo(
  accessToken: string
): Promise<DouyinUserInfo> {
  try {
    const response = await axios.get(DOUYIN_USERINFO_URL, {
      params: {
        client_key: process.env.DOUYIN_CLIENT_KEY,
        access_token: accessToken,
      },
    });

    if (response.data.status_code !== 0) {
      throw new Error(`Douyin API error: ${response.data.message}`);
    }

    return response.data.data;
  } catch (error) {
    console.error('Failed to get Douyin user info:', error);
    throw new Error('Failed to get Douyin user information');
  }
}

/**
 * 刷新抖音access_token
 */
export async function refreshDouyinToken(
  refreshToken: string
): Promise<DouyinTokenResponse> {
  try {
    const response = await axios.post(DOUYIN_TOKEN_URL, {
      client_key: process.env.DOUYIN_CLIENT_KEY,
      client_secret: process.env.DOUYIN_CLIENT_SECRET,
      refresh_token: refreshToken,
      grant_type: 'refresh_token',
    });

    if (response.data.status_code !== 0) {
      throw new Error(`Douyin API error: ${response.data.message}`);
    }

    return response.data.data;
  } catch (error) {
    console.error('Failed to refresh Douyin token:', error);
    throw new Error('Failed to refresh Douyin access token');
  }
}
```

---

## 后端路由代码

### QQ OAuth路由 (`server/routers/oauth-qq.ts`)

```typescript
import { publicProcedure, router } from '../_core/trpc';
import { z } from 'zod';
import * as db from '../db';
import * as qqOAuth from '../oauth/qq';
import { generateRandomString } from '../utils/random';
import { sanitizeUser } from '../auth';

export const qqOAuthRouter = router({
  /**
   * 获取QQ授权URL
   */
  getAuthUrl: publicProcedure.query(async () => {
    const state = generateRandomString(32);
    const authUrl = qqOAuth.generateQQAuthUrl(state);
    return {
      authUrl,
      state,
    };
  }),

  /**
   * 处理QQ授权回调
   */
  handleCallback: publicProcedure
    .input(
      z.object({
        code: z.string(),
        state: z.string(),
      })
    )
    .mutation(async ({ input, ctx }) => {
      try {
        // 用code换取access_token
        const tokenData = await qqOAuth.exchangeQQCode(input.code);

        // 获取用户OpenID
        const openid = await qqOAuth.getQQOpenID(tokenData.access_token);

        // 获取用户信息
        const userInfo = await qqOAuth.getQQUserInfo(
          tokenData.access_token,
          openid
        );

        // 查找或创建用户
        let user = await db.getUserByQQId(userInfo.openid);

        if (!user) {
          // 创建新用户
          user = await db.createUser({
            name: userInfo.nickname,
            qqId: userInfo.openid,
            avatarUrl: userInfo.figureurl,
            loginMethod: 'qq_oauth',
            isEmailVerified: true,
          });
        } else {
          // 更新用户信息
          user = await db.updateUser(user.id, {
            name: userInfo.nickname,
            avatarUrl: userInfo.figureurl,
          });
        }

        return {
          success: true,
          user: sanitizeUser(user),
          accessToken: tokenData.access_token,
          refreshToken: tokenData.refresh_token,
        };
      } catch (error) {
        console.error('[QQ OAuth] Callback error:', error);
        throw error;
      }
    }),
});
```

### 抖音OAuth路由 (`server/routers/oauth-douyin.ts`)

```typescript
import { publicProcedure, router } from '../_core/trpc';
import { z } from 'zod';
import * as db from '../db';
import * as douyinOAuth from '../oauth/douyin';
import { generateRandomString } from '../utils/random';
import { sanitizeUser } from '../auth';

export const douyinOAuthRouter = router({
  /**
   * 获取抖音授权URL
   */
  getAuthUrl: publicProcedure.query(async () => {
    const state = generateRandomString(32);
    const authUrl = douyinOAuth.generateDouyinAuthUrl(state);
    return {
      authUrl,
      state,
    };
  }),

  /**
   * 处理抖音授权回调
   */
  handleCallback: publicProcedure
    .input(
      z.object({
        code: z.string(),
        state: z.string(),
      })
    )
    .mutation(async ({ input, ctx }) => {
      try {
        // 用code换取access_token
        const tokenData = await douyinOAuth.exchangeDouyinCode(input.code);

        // 获取用户信息
        const userInfo = await douyinOAuth.getDouyinUserInfo(
          tokenData.access_token
        );

        // 查找或创建用户
        let user = await db.getUserByDouyinId(userInfo.open_id);

        if (!user) {
          // 创建新用户
          user = await db.createUser({
            name: userInfo.nickname,
            douyinId: userInfo.open_id,
            avatarUrl: userInfo.avatar,
            loginMethod: 'douyin_oauth',
            isEmailVerified: true,
          });
        } else {
          // 更新用户信息
          user = await db.updateUser(user.id, {
            name: userInfo.nickname,
            avatarUrl: userInfo.avatar,
          });
        }

        return {
          success: true,
          user: sanitizeUser(user),
          accessToken: tokenData.access_token,
          refreshToken: tokenData.refresh_token,
        };
      } catch (error) {
        console.error('[Douyin OAuth] Callback error:', error);
        throw error;
      }
    }),
});
```

---

## 前端组件代码

### OAuth登录按钮组件 (`client/src/components/OAuthLoginButtons.tsx`)

```typescript
import { Button } from '@/components/ui/button';
import { trpc } from '@/lib/trpc';
import { useLocation } from 'wouter';
import { toast } from 'sonner';
import { Loader2 } from 'lucide-react';

export default function OAuthLoginButtons() {
  const [, setLocation] = useLocation();
  const qqAuthQuery = trpc.oauth.qq.getAuthUrl.useQuery();
  const douyinAuthQuery = trpc.oauth.douyin.getAuthUrl.useQuery();

  const handleQQLogin = () => {
    if (qqAuthQuery.data?.authUrl) {
      localStorage.setItem('qq_oauth_state', qqAuthQuery.data.state);
      window.location.href = qqAuthQuery.data.authUrl;
    }
  };

  const handleDouyinLogin = () => {
    if (douyinAuthQuery.data?.authUrl) {
      localStorage.setItem('douyin_oauth_state', douyinAuthQuery.data.state);
      window.location.href = douyinAuthQuery.data.authUrl;
    }
  };

  return (
    <div className="space-y-2">
      <Button
        onClick={handleQQLogin}
        disabled={qqAuthQuery.isLoading}
        className="w-full bg-blue-600 hover:bg-blue-700"
      >
        {qqAuthQuery.isLoading && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
        使用QQ登录
      </Button>
      <Button
        onClick={handleDouyinLogin}
        disabled={douyinAuthQuery.isLoading}
        className="w-full bg-red-600 hover:bg-red-700"
      >
        {douyinAuthQuery.isLoading && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
        使用抖音登录
      </Button>
    </div>
  );
}
```

### OAuth回调处理页面 (`client/src/pages/OAuthCallback.tsx`)

```typescript
import { useEffect } from 'react';
import { useLocation, useSearch } from 'wouter';
import { trpc } from '@/lib/trpc';
import { toast } from 'sonner';
import { Loader2 } from 'lucide-react';

export default function OAuthCallback() {
  const [, setLocation] = useLocation();
  const search = useSearch();
  const params = new URLSearchParams(search);

  const code = params.get('code');
  const state = params.get('state');
  const provider = params.get('provider'); // 'qq' or 'douyin'

  const qqCallbackMutation = trpc.oauth.qq.handleCallback.useMutation();
  const douyinCallbackMutation = trpc.oauth.douyin.handleCallback.useMutation();

  useEffect(() => {
    if (!code || !state || !provider) {
      toast.error('缺少必要的授权参数');
      setLocation('/login');
      return;
    }

    // 验证state
    const savedState = localStorage.getItem(`${provider}_oauth_state`);
    if (savedState !== state) {
      toast.error('授权状态验证失败，请重新登录');
      setLocation('/login');
      return;
    }

    // 处理回调
    const handleCallback = async () => {
      try {
        if (provider === 'qq') {
          await qqCallbackMutation.mutateAsync({ code, state });
        } else if (provider === 'douyin') {
          await douyinCallbackMutation.mutateAsync({ code, state });
        }

        // 清除保存的state
        localStorage.removeItem(`${provider}_oauth_state`);

        toast.success('登录成功');
        setLocation('/dashboard');
      } catch (error) {
        toast.error(
          `登录失败: ${error instanceof Error ? error.message : '未知错误'}`
        );
        setLocation('/login');
      }
    };

    handleCallback();
  }, [code, state, provider]);

  return (
    <div className="flex items-center justify-center min-h-screen">
      <div className="text-center">
        <Loader2 className="w-8 h-8 animate-spin mx-auto mb-4" />
        <p className="text-gray-600">正在处理授权，请稍候...</p>
      </div>
    </div>
  );
}
```

---

## 数据库辅助函数

### 在 `server/db.ts` 中添加以下函数

```typescript
import { db } from './db';
import { users } from '@/drizzle/schema';
import { eq } from 'drizzle-orm';

/**
 * 通过QQ ID查找用户
 */
export async function getUserByQQId(qqId: string) {
  return await db.query.users.findFirst({
    where: eq(users.qqId, qqId),
  });
}

/**
 * 通过抖音ID查找用户
 */
export async function getUserByDouyinId(douyinId: string) {
  return await db.query.users.findFirst({
    where: eq(users.douyinId, douyinId),
  });
}

/**
 * 创建新用户
 */
export async function createUser(data: {
  name: string;
  email?: string;
  qqId?: string;
  douyinId?: string;
  avatarUrl?: string;
  loginMethod?: string;
  isEmailVerified?: boolean;
}) {
  const result = await db.insert(users).values({
    name: data.name,
    email: data.email,
    qqId: data.qqId,
    douyinId: data.douyinId,
    avatarUrl: data.avatarUrl,
    loginMethod: data.loginMethod || 'local',
    isEmailVerified: data.isEmailVerified || false,
  });

  return await db.query.users.findFirst({
    where: eq(users.id, result[0].insertId),
  });
}

/**
 * 更新用户信息
 */
export async function updateUser(
  userId: string,
  data: Partial<{
    name: string;
    email: string;
    avatarUrl: string;
    qqId: string;
    douyinId: string;
  }>
) {
  await db.update(users).set(data).where(eq(users.id, userId));

  return await db.query.users.findFirst({
    where: eq(users.id, userId),
  });
}
```

---

## 工具函数

### 随机字符串生成 (`server/utils/random.ts`)

```typescript
/**
 * 生成随机字符串
 */
export function generateRandomString(length: number): string {
  const chars =
    'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  let result = '';
  for (let i = 0; i < length; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}

/**
 * 生成UUID
 */
export function generateUUID(): string {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function (c) {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}
```

### 用户信息清理 (`server/auth.ts`)

```typescript
/**
 * 清理用户信息（移除敏感字段）
 */
export function sanitizeUser(user: any) {
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    avatarUrl: user.avatarUrl,
    role: user.role,
    createdAt: user.createdAt,
    updatedAt: user.updatedAt,
  };
}
```

---

## 集成到主路由

### 更新 `server/routers.ts`

```typescript
import { router, publicProcedure } from './_core/trpc';
import { qqOAuthRouter } from './routers/oauth-qq';
import { douyinOAuthRouter } from './routers/oauth-douyin';

export const appRouter = router({
  // ... 其他路由
  oauth: router({
    qq: qqOAuthRouter,
    douyin: douyinOAuthRouter,
  }),
});

export type AppRouter = typeof appRouter;
```

### 更新 `client/src/App.tsx`

```typescript
import { Route, Switch } from 'wouter';
import OAuthCallback from '@/pages/OAuthCallback';
import Login from '@/pages/Login';

export default function App() {
  return (
    <Switch>
      <Route path="/login" component={Login} />
      <Route path="/oauth/callback" component={OAuthCallback} />
      {/* 其他路由 */}
    </Switch>
  );
}
```

---

## 完整的环境变量示例

```env
# QQ OAuth
QQ_APP_ID=123456789
QQ_APP_KEY=abcdef1234567890
QQ_REDIRECT_URI=https://your-domain.com/api/oauth/qq/callback

# 抖音OAuth
DOUYIN_CLIENT_KEY=aw123456789
DOUYIN_CLIENT_SECRET=xyz987654321
DOUYIN_REDIRECT_URI=https://your-domain.com/api/oauth/douyin/callback

# 数据库
DATABASE_URL=mysql://user:password@host:3306/database

# JWT
CLASSCLICKER_SESSION_SECRET=your_jwt_secret_key
```

---

## 测试代码示例

### 单元测试 (`server/oauth.test.ts`)

```typescript
import { describe, it, expect, vi } from 'vitest';
import * as qqOAuth from '../oauth/qq';
import * as douyinOAuth from '../oauth/douyin';

describe('OAuth Services', () => {
  describe('QQ OAuth', () => {
    it('should generate valid auth URL', () => {
      const url = qqOAuth.generateQQAuthUrl('test_state');
      expect(url).toContain('client_id');
      expect(url).toContain('response_type=code');
      expect(url).toContain('state=test_state');
    });
  });

  describe('Douyin OAuth', () => {
    it('should generate valid auth URL', () => {
      const url = douyinOAuth.generateDouyinAuthUrl('test_state');
      expect(url).toContain('client_key');
      expect(url).toContain('response_type=code');
      expect(url).toContain('state=test_state');
    });
  });
});
```

---

## 常见错误和解决方案

| 错误 | 原因 | 解决方案 |
|------|------|---------|
| `Invalid state parameter` | State验证失败 | 确保前后端state一致 |
| `API error: invalid code` | 授权码无效或过期 | 重新获取授权码 |
| `Unauthorized` | AppKey或AppSecret错误 | 检查环境变量配置 |
| `Redirect URI mismatch` | 回调地址不匹配 | 检查OAuth平台设置 |
| `Token expired` | Access token已过期 | 使用refresh_token刷新 |

