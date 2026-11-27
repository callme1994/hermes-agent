import { BrowserWindow, ipcMain } from 'electron'

import type { RuoyiAccount, RuoyiCaptcha, RuoyiLogin } from './ruoyi-auth-types'

interface RuoyiReply {
  captchaEnabled?: boolean
  code?: number
  data?: { access_token?: string }
  img?: string
  msg?: string
  user?: { nickName?: string; userName?: string }
  uuid?: string
}

const origin = 'http://127.0.0.1:8080'
const changed = 'hermes:ruoyi-auth:changed'

export function registerRuoyiAuth(rendererUrl: () => string) {
  let session: { account: RuoyiAccount; token: string } | null = null
  let pending = false

  function notify() {
    for (const window of BrowserWindow.getAllWindows()) {
      if (!window.webContents.isDestroyed() && isRenderer(window.webContents.getURL())) {
        window.webContents.send(changed, session?.account ?? null)
      }
    }
  }

  function isRenderer(value: string | undefined) {
    if (!value) {return false}

    const actual = new URL(value)
    const expected = new URL(rendererUrl())

    return actual.protocol === expected.protocol && actual.host === expected.host && actual.pathname === expected.pathname
  }

  async function request(path: string, init: RequestInit = {}): Promise<RuoyiReply> {
    let response: Response

    try {
      response = await fetch(new URL(path, origin), {
        ...init,
        redirect: 'error',
        signal: AbortSignal.timeout(10000)
      })
    } catch {
      throw new Error('无法连接本地若依网关（127.0.0.1:8080），请确认网关已启动。')
    }

    const body = (await response.json().catch(() => null)) as RuoyiReply | null

    if (!response.ok || body?.code !== 200) {
      throw new Error(typeof body?.msg === 'string' ? body.msg : `若依请求失败（HTTP ${response.status}）。`)
    }

    return body
  }

  function handle<T extends unknown[]>(action: string, fn: (...args: T) => unknown) {
    ipcMain.handle(`hermes:ruoyi-auth:${action}`, (event, ...args: T) => {
      if (event.senderFrame !== event.sender.mainFrame || !isRenderer(event.senderFrame?.url)) {
        throw new Error('登录请求来自无效窗口。')
      }

      return fn(...args)
    })
  }

  handle('status', () => session?.account ?? null)

  handle('captcha', async (): Promise<RuoyiCaptcha> => {
    const body = await request('/code')

    if (body.captchaEnabled === false) {return { enabled: false }}

    if (body.captchaEnabled !== true || typeof body.uuid !== 'string' || typeof body.img !== 'string' ||
      !/^[A-Za-z0-9+/]+={0,2}$/.test(body.img)) {
      throw new Error('若依网关没有返回有效的验证码。')
    }

    return { enabled: true, image: body.img, uuid: body.uuid }
  })

  handle('login', async (input: RuoyiLogin): Promise<RuoyiAccount> => {
    if (pending || session) {throw new Error('已有登录会话或正在登录。')}

    if (typeof input?.username !== 'string' || !input.username.trim() ||
      typeof input.password !== 'string' || !input.password) {
      throw new Error('请输入账号和密码。')
    }

    pending = true

    try {
      const result = await request('/auth/login', {
        method: 'POST',
        body: JSON.stringify({ username: input.username.trim(), password: input.password, code: input.code, uuid: input.uuid }),
        headers: { 'Content-Type': 'application/json' }
      })

      const token = result.data?.access_token

      if (typeof token !== 'string' || !token) {throw new Error('若依没有返回有效的登录令牌。')}

      const headers = { Authorization: `Bearer ${token}` }
      let profile: RuoyiReply

      try {
        profile = await request('/system/user/getInfo', { headers })

        if (!profile.user?.userName) {throw new Error('若依没有返回有效的用户信息。')}
      } catch (error) {
        await request('/auth/logout', { method: 'DELETE', headers }).catch(() => {})
        throw error
      }

      const account = { displayName: profile.user.nickName || profile.user.userName, username: profile.user.userName }

      session = { account, token }
      notify()

      return account
    } finally {
      pending = false
    }
  })

  handle('logout', async () => {
    if (!session || pending) {return}
    const { token } = session

    pending = true

    try {
      await request('/auth/logout', { method: 'DELETE', headers: { Authorization: `Bearer ${token}` } })
    } finally {
      session = null
      pending = false
      notify()
    }
  })
}
