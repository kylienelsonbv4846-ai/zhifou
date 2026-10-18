# QQ和抖音OAuth集成完整方案

## 目录
1. [概述](#概述)
2. [QQ OAuth集成](#qq-oauth集成)
3. [抖音OAuth集成](#抖音oauth集成)
4. [后端实现](#后端实现)
5. [前端实现](#前端实现)
6. [部署和配置](#部署和配置)
7. [安全最佳实践](#安全最佳实践)

---

## 概述

本文档提供ClassClicker应用集成QQ和抖音官方OAuth 2.0的完整方案。通过集成这两个社交平台的OAuth，用户可以使用QQ或抖音账号快速登录ClassClicker。

### OAuth 2.0流程概览

```
┌─────────────┐         ┌──────────────┐         ┌──────────────┐
│   用户      │         │ ClassClicker │         │ QQ/抖音平台  │
│             │         │   应用       │         │              │
└──────┬──────┘         └──────┬───────┘         └──────┬───────┘
       │                       │                        │
       │  1. 点击登录按钮      │                        │
       ├──────────────────────>│                        │
       │                       │  2. 重定向到授权页面  │
       │                       ├───────────────────────>│
       │                       │                        │
       │  3. 用户授权          │                        │
       │<──────────────────────┤                        │
       │                       │  4. 返回授权码(code)  │
       │                       │<───────────────────────
       │                       │                        │
       │                       │  5. 后端用code换token │
       │                       ├───────────────────────>│
       │                       │  6. 返回access_token  │
       │                       │<───────────────────────
       │                       │                        │
       │                       │  7. 用token获取用户信息
       │                       ├───────────────────────>│
       │                       │  8. 返回用户信息      │
       │                       │<───────────────────────
       │  9. 登录成功          │                        │
       │<──────────────────────┤                        │
```

---

## QQ OAuth集成

### 1. 准备工作

#### 1.1 注册QQ互联开发者账户

1. 访问 [QQ互联官网](https://connect.qq.com/)
2. 使用QQ账号登录或注册开发者账户
3. 完成实名认证（企业或个人）
4. 审核通过后获得开发者权限

#### 1.2 创建应用

1. 登录 [QQ互联管理中心](https://connect.qq.com/manage.html)
2. 点击"创建应用"
3. 选择应用类型为"网站应用"
4. 填写应用信息：
   - **应用名称**: ClassClicker
   - **应用描述**: 课堂即时反馈系统
   - **应用图标**: 上传ClassClicker的logo
   - **应用首页**: https://your-domain.com
   - **回调地址**: https://your-domain.com/api/oauth/qq/callback

5. 应用审核通过后，获得：
   - **AppID**: 用于识别应用
   - **AppKey**: 用于后端验证，需妥善保管

#### 1.3 获取AppID和AppKey

```bash
# 在QQ互联管理中心查看
# 路径: 应用管理 > 应用详情 > 基本信息
```

### 2. QQ OAuth流程详解

#### 2.1 授权流程

**Step 1: 用户点击QQ登录按钮**

前端跳转到QQ授权页面：
```
https://graph.qq.com/oauth2.0/authorize?
  client_id={AppID}
  &response_type=code
  &scope=get_user_info
  &redirect_uri={回调地址}
  &state={随机字符串}
```

**Step 2: 用户授权**

用户在QQ平台授权后，QQ会重定向到回调地址并附带授权码：
```
https://your-domain.com/api/oauth/qq/callback?
  code={授权码}
  &state={随机字符串}
```

**Step 3: 后端用授权码换取access_token**

```bash
POST https://graph.qq.com/oauth2.0/token
  client_id={AppID}
  &client_secret={AppKey}
  &code={授权码}
  &grant_type=authorization_code
  &redirect_uri={回调地址}
```

响应示例：
```json
{
  "access_token": "FE04...B05A",
  "expires_in": 7776000,
  "refresh_token": "88E4...405E"
}
```

**Step 4: 用access_token获取用户OpenID**

```bash
GET https://graph.qq.com/oauth2.0/me?
  access_token={access_token}
  &fmt=json
```

响应示例：
```json
{
  "client_id": "{AppID}",
  "openid": "0B893CE028...D629",
  "unionid": "o6_bmasdasdsad..."
}
```

**Step 5: 用access_token和OpenID获取用户信息**

```bash
GET https://graph.qq.com/user/get_user_info?
  access_token={access_token}
  &oauth_consumer_key={AppID}
  &openid={openid}
```

响应示例：
```json
{
  "ret": 0,
  "msg": "",
  "is_lost": 0,
  "nickname": "用户昵称",
  "gender": "男",
  "province": "北京",
  "city": "朝阳区",
  "year": 1990,
  "figureurl": "http://q.qlogo.cn/...",
  "figureurl_1": "http://q.qlogo.cn/...",
  "figureurl_2": "http://q.qlogo.cn/..."
}
```

### 3. QQ OAuth参数说明

| 参数 | 说明 | 获取方式 |
|------|------|---------|
| AppID | 应用唯一标识 | QQ互联管理中心 |
| AppKey | 应用密钥 | QQ互联管理中心 |
| access_token | 用户授权凭证 | OAuth授权流程 |
| openid | 用户在该应用的唯一标识 | 通过access_token获取 |
| refresh_token | 刷新token的凭证 | OAuth授权流程 |

### 4. QQ OAuth权限范围

| Scope | 说明 |
|-------|------|
| get_user_info | 获取用户基本信息 |
| get_simple_userinfo | 获取用户简单信息 |
| get_vip_info | 获取用户VIP信息 |
| get_vip_rich_info | 获取用户VIP富信息 |

---

## 抖音OAuth集成

### 1. 准备工作

#### 1.1 注册抖音开放平台开发者账户

1. 访问 [抖音开放平台](https://open.douyin.com/)
2. 使用手机号或邮箱注册开发者账户
3. 完成实名认证（企业或个人）
4. 审核通过后获得开发者权限

#### 1.2 创建应用

1. 登录 [抖音开放平台管理中心](https://open.douyin.com/platform/apps)
2. 点击"创建应用"
3. 选择应用类型为"网站应用"
4. 填写应用信息：
   - **应用名称**: ClassClicker
   - **应用描述**: 课堂即时反馈系统
   - **应用图标**: 上传ClassClicker的logo
   - **应用首页**: https://your-domain.com
   - **回调地址**: https://your-domain.com/api/oauth/douyin/callback

5. 应用审核通过后，获得：
   - **Client Key**: 用于识别应用
   - **Client Secret**: 用于后端验证，需妥善保管

#### 1.3 获取Client Key和Client Secret

```bash
# 在抖音开放平台管理中心查看
# 路径: 应用管理 > 应用详情 > 基本信息
```

### 2. 抖音OAuth流程详解

#### 2.1 授权流程

**Step 1: 用户点击抖音登录按钮**

前端跳转到抖音授权页面：
```
https://open.douyin.com/platform/oauth/connect?
  client_key={Client Key}
  &response_type=code
  &scope=user.info.basic
  &redirect_uri={回调地址}
  &state={随机字符串}
```

**Step 2: 用户授权**

用户在抖音平台授权后，抖音会重定向到回调地址并附带授权码：
```
https://your-domain.com/api/oauth/douyin/callback?
  code={授权码}
  &state={随机字符串}
```

**Step 3: 后端用授权码换取access_token**

```bash
POST https://open.douyin.com/oauth/access_token/
  client_key={Client Key}
  &client_secret={Client Secret}
  &code={授权码}
  &grant_type=authorization_code
```

响应示例：
```json
{
  "data": {
    "access_token": "pat_xxx",
    "expires_in": 1296000,
    "refresh_expires_in": 2592000,
    "refresh_token": "prt_xxx",
    "scope": "user.info.basic",
    "token_type": "Bearer"
  },
  "message": "success",
  "status_code": 0
}
```

**Step 4: 用access_token获取用户信息**

```bash
GET https://open.douyin.com/oauth/userinfo/
  client_key={Client Key}
  &access_token={access_token}
```

响应示例：
```json
{
  "data": {
    "union_id": "ou_xxx",
    "open_id": "xxx",
    "nickname": "用户昵称",
    "avatar": "https://...",
    "gender": 1,
    "province": "北京",
    "city": "朝阳区"
  },
  "message": "success",
  "status_code": 0
}
```

### 3. 抖音OAuth参数说明

| 参数 | 说明 | 获取方式 |
|------|------|---------|
| Client Key | 应用唯一标识 | 抖音开放平台管理中心 |
| Client Secret | 应用密钥 | 抖音开放平台管理中心 |
| access_token | 用户授权凭证 | OAuth授权流程 |
| open_id | 用户在该应用的唯一标识 | 通过access_token获取 |
| union_id | 用户在抖音生态中的唯一标识 | 通过access_token获取 |
| refresh_token | 刷新token的凭证 | OAuth授权流程 |

### 4. 抖音OAuth权限范围

| Scope | 说明 |
|-------|------|
| user.info.basic | 获取用户基本信息 |
| user.info.profile | 获取用户详细信息 |
| video.list | 获取用户视频列表 |
| video.create | 创建视频 |

---

## 后端实现

### 1. 环境变量配置

在 `.env` 文件中添加以下配置：

```env
# QQ OAuth
QQ_APP_ID=your_qq_app_id
QQ_APP_KEY=your_qq_app_key
QQ_REDIRECT_URI=https://your-domain.com/api/oauth/qq/callback

# 抖音OAuth
DOUYIN_CLIENT_KEY=your_douyin_client_key
DOUYIN_CLIENT_SECRET=your_douyin_client_secret
DOUYIN_REDIRECT_URI=https://your-domain.com/api/oauth/douyin/callback
```

### 2. QQ OAuth后端实现

#### 2.1 创建QQ OAuth服务

文件: `server/oauth/qq.ts`

```typescript
import axios from 'axios';
import { z } from 'zod';

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
```

#### 2.2 创建QQ OAuth路由

文件: `server/routers/oauth-qq.ts`

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
    // 在session中存储state用于验证
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
        // 验证state（从session中获取）
        // const sessionState = ctx.session?.qqAuthState;
        // if (sessionState !== input.state) {
        //   throw new Error('Invalid state parameter');
        // }

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
            isEmailVerified: true, // OAuth用户默认邮箱已验证
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

### 3. 抖音OAuth后端实现

#### 3.1 创建抖音OAuth服务

文件: `server/oauth/douyin.ts`

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
```

#### 3.2 创建抖音OAuth路由

文件: `server/routers/oauth-douyin.ts`

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

### 4. 集成到主路由

在 `server/routers.ts` 中添加：

```typescript
import { qqOAuthRouter } from './routers/oauth-qq';
import { douyinOAuthRouter } from './routers/oauth-douyin';

export const appRouter = router({
  // ... 其他路由
  oauth: router({
    qq: qqOAuthRouter,
    douyin: douyinOAuthRouter,
  }),
});
```

---

## 前端实现

### 1. 创建OAuth登录按钮组件

文件: `client/src/components/OAuthLoginButtons.tsx`

```typescript
import { Button } from '@/components/ui/button';
import { trpc } from '@/lib/trpc';
import { useLocation } from 'wouter';
import { toast } from 'sonner';

export default function OAuthLoginButtons() {
  const [, setLocation] = useLocation();
  const qqAuthMutation = trpc.oauth.qq.getAuthUrl.useQuery();
  const douyinAuthMutation = trpc.oauth.douyin.getAuthUrl.useQuery();

  const handleQQLogin = () => {
    if (qqAuthMutation.data?.authUrl) {
      // 保存state到localStorage用于验证
      localStorage.setItem('qq_oauth_state', qqAuthMutation.data.state);
      window.location.href = qqAuthMutation.data.authUrl;
    }
  };

  const handleDouyinLogin = () => {
    if (douyinAuthMutation.data?.authUrl) {
      // 保存state到localStorage用于验证
      localStorage.setItem('douyin_oauth_state', douyinAuthMutation.data.state);
      window.location.href = douyinAuthMutation.data.authUrl;
    }
  };

  return (
    <div className="space-y-2">
      <Button
        onClick={handleQQLogin}
        disabled={qqAuthMutation.isLoading}
        className="w-full bg-blue-600 hover:bg-blue-700"
      >
        使用QQ登录
      </Button>
      <Button
        onClick={handleDouyinLogin}
        disabled={douyinAuthMutation.isLoading}
        className="w-full bg-red-600 hover:bg-red-700"
      >
        使用抖音登录
      </Button>
    </div>
  );
}
```

### 2. 创建OAuth回调处理页面

文件: `client/src/pages/OAuthCallback.tsx`

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
        toast.error(`登录失败: ${error instanceof Error ? error.message : '未知错误'}`);
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

### 3. 在登录页面集成OAuth按钮

文件: `client/src/pages/Login.tsx`

```typescript
import OAuthLoginButtons from '@/components/OAuthLoginButtons';

export default function Login() {
  return (
    <div className="space-y-6">
      {/* 传统登录表单 */}
      <div>
        <h2>邮箱登录</h2>
        {/* ... 邮箱登录表单 */}
      </div>

      <div className="relative">
        <div className="absolute inset-0 flex items-center">
          <div className="w-full border-t border-gray-300"></div>
        </div>
        <div className="relative flex justify-center text-sm">
          <span className="px-2 bg-white text-gray-500">或使用社交账号登录</span>
        </div>
      </div>

      {/* OAuth登录按钮 */}
      <OAuthLoginButtons />
    </div>
  );
}
```

---

## 部署和配置

### 1. 环境变量配置

#### 1.1 开发环境 (`.env.local`)

```env
# QQ OAuth
QQ_APP_ID=your_qq_app_id_dev
QQ_APP_KEY=your_qq_app_key_dev
QQ_REDIRECT_URI=http://localhost:3000/api/oauth/qq/callback

# 抖音OAuth
DOUYIN_CLIENT_KEY=your_douyin_client_key_dev
DOUYIN_CLIENT_SECRET=your_douyin_client_secret_dev
DOUYIN_REDIRECT_URI=http://localhost:3000/api/oauth/douyin/callback
```

#### 1.2 生产环境 (`.env.production`)

```env
# QQ OAuth
QQ_APP_ID=your_qq_app_id_prod
QQ_APP_KEY=your_qq_app_key_prod
QQ_REDIRECT_URI=https://your-domain.com/api/oauth/qq/callback

# 抖音OAuth
DOUYIN_CLIENT_KEY=your_douyin_client_key_prod
DOUYIN_CLIENT_SECRET=your_douyin_client_secret_prod
DOUYIN_REDIRECT_URI=https://your-domain.com/api/oauth/douyin/callback
```

### 2. 数据库配置

确保users表包含以下字段：

```sql
ALTER TABLE users ADD COLUMN qqId VARCHAR(128) UNIQUE NULL AFTER wechatId;
ALTER TABLE users ADD COLUMN douyinId VARCHAR(128) UNIQUE NULL AFTER qqId;
ALTER TABLE users ADD COLUMN loginMethod VARCHAR(64) DEFAULT 'local';
```

### 3. 依赖安装

```bash
npm install axios
# 或
pnpm add axios
```

---

## 安全最佳实践

### 1. 敏感信息保护

✅ **应该做**：
- 将AppKey、AppSecret等敏感信息存储在服务器环境变量中
- 所有OAuth token交换操作都在后端进行
- 使用HTTPS加密所有通信

❌ **不应该做**：
- 在前端代码中硬编码AppKey或AppSecret
- 在localStorage中存储access_token
- 通过URL传递敏感信息

### 2. State参数验证

```typescript
// 生成随机state
const state = crypto.randomBytes(32).toString('hex');

// 存储在session中
req.session.oauthState = state;

// 回调时验证
if (req.query.state !== req.session.oauthState) {
  throw new Error('Invalid state parameter');
}
```

### 3. Token安全管理

```typescript
// Token应该存储在HttpOnly Cookie中
res.setHeader('Set-Cookie', `access_token=${token}; HttpOnly; Secure; SameSite=Strict`);

// 不要在localStorage中存储敏感token
// localStorage.setItem('access_token', token); // ❌ 不安全
```

### 4. CORS配置

```typescript
// 只允许来自受信任域名的请求
const corsOptions = {
  origin: ['https://your-domain.com'],
  credentials: true,
};
```

### 5. 速率限制

```typescript
// 防止暴力攻击
const rateLimit = require('express-rate-limit');

const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15分钟
  max: 5, // 限制5次请求
});

app.post('/api/oauth/callback', limiter, handleCallback);
```

### 6. 错误处理

```typescript
// 不要在错误信息中泄露敏感信息
try {
  // OAuth操作
} catch (error) {
  // ❌ 不要这样
  console.log(`OAuth failed: ${error.message}`);

  // ✅ 应该这样
  console.error('[OAuth] Error:', error);
  throw new Error('Authorization failed. Please try again.');
}
```

---

## 测试

### 1. 单元测试

文件: `server/oauth.test.ts`

```typescript
import { describe, it, expect, beforeEach, vi } from 'vitest';
import * as qqOAuth from '../oauth/qq';
import * as douyinOAuth from '../oauth/douyin';

describe('QQ OAuth', () => {
  it('should generate valid auth URL', () => {
    const url = qqOAuth.generateQQAuthUrl('test_state');
    expect(url).toContain('client_id');
    expect(url).toContain('response_type=code');
    expect(url).toContain('state=test_state');
  });

  it('should exchange code for token', async () => {
    // Mock axios
    vi.mock('axios');
    // ... 测试代码
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
```

### 2. 集成测试

```typescript
describe('OAuth Integration', () => {
  it('should complete QQ OAuth flow', async () => {
    // 1. 获取授权URL
    // 2. 模拟用户授权
    // 3. 处理回调
    // 4. 验证用户已创建/更新
  });

  it('should complete Douyin OAuth flow', async () => {
    // 类似QQ的测试流程
  });
});
```

---

## 常见问题

### Q1: 如何处理OAuth token过期？

**A**: 使用refresh_token刷新access_token：

```typescript
export async function refreshQQToken(refreshToken: string) {
  const response = await axios.get(QQ_TOKEN_URL, {
    params: {
      client_id: process.env.QQ_APP_ID,
      client_secret: process.env.QQ_APP_KEY,
      refresh_token: refreshToken,
      grant_type: 'refresh_token',
    },
  });
  return response.data;
}
```

### Q2: 如何处理用户解除授权？

**A**: 监听OAuth平台的webhook通知，及时删除用户的OAuth绑定：

```typescript
// 处理解授权通知
app.post('/webhooks/oauth/revoke', (req, res) => {
  const { open_id, provider } = req.body;
  
  // 删除用户的OAuth绑定
  if (provider === 'qq') {
    db.updateUser(userId, { qqId: null });
  } else if (provider === 'douyin') {
    db.updateUser(userId, { douyinId: null });
  }
  
  res.json({ success: true });
});
```

### Q3: 如何支持多个OAuth账号绑定？

**A**: 在users表中为每个OAuth平台添加单独的字段：

```sql
ALTER TABLE users ADD COLUMN qqId VARCHAR(128) UNIQUE;
ALTER TABLE users ADD COLUMN douyinId VARCHAR(128) UNIQUE;
ALTER TABLE users ADD COLUMN wechatId VARCHAR(128) UNIQUE;
```

然后在登录时检查所有字段：

```typescript
const user = await db.getUserByQQId(qqId) ||
             await db.getUserByDouyinId(douyinId) ||
             await db.getUserByWeChatId(wechatId);
```

---

## 参考资源

- [QQ互联官方文档](https://connect.qq.com/)
- [QQ OAuth 2.0 Wiki](https://wiki.connect.qq.com/oauth2-0%E7%AE%80%E4%BB%8B)
- [抖音开放平台](https://open.douyin.com/)
- [抖音OAuth文档](https://open.douyin.com/platform/resource/docs/develop/permission/web/oauth2)
- [OAuth 2.0标准](https://tools.ietf.org/html/rfc6749)

---

## 更新日志

| 版本 | 日期 | 更新内容 |
|------|------|---------|
| 1.0 | 2026-05-06 | 初始版本，包含QQ和抖音OAuth完整集成方案 |

