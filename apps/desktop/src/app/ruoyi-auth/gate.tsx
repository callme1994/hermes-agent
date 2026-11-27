import { type FormEvent, type ReactNode, useCallback, useEffect, useRef, useState } from 'react'

import { Alert, AlertDescription } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { AlertCircle } from '@/lib/icons'

import type { RuoyiAccount, RuoyiAuthBridge, RuoyiCaptcha } from '../../../electron/ruoyi-auth-types'

import { RuoyiAccountContext } from './account-menu'
import Orb from './orb'

interface GateProps {
  children: ReactNode
  quickEntry?: boolean
}

function message(error: unknown) {
  return error instanceof Error
    ? error.message.replace(/^Error invoking remote method '[^']+': (?:Error: )?/, '')
    : '若依请求失败，请重试。'
}

export function RuoyiAuthGate({ children, quickEntry }: GateProps) {
  const auth = window.ruoyiAuth
  const [account, setAccount] = useState<RuoyiAccount | null | undefined>()
  const [statusError, setStatusError] = useState('')
  const [signingOut, setSigningOut] = useState(false)

  useEffect(() => {
    if (!auth) {
      return
    }

    let active = true
    let receivedChange = false

    const unsubscribe = auth.onChange(next => {
      receivedChange = true

      if (active) {
        setAccount(next)
      }
    })

    auth.status().then(
      next => {
        if (active && !receivedChange) {
          setAccount(next)
        }
      },
      error => {
        if (active && !receivedChange) {
          setStatusError(message(error))
        }
      }
    )

    return () => {
      active = false
      unsubscribe()
    }
  }, [auth])

  if (!auth) {
    return children
  }

  if (account === undefined) {
    return (
      <div className="grid h-full place-items-center bg-background p-6 text-sm" role="status">
        {statusError || '正在读取登录状态…'}
      </div>
    )
  }

  if (!account) {
    if (quickEntry) {
      return <p className="m-3 rounded-lg border bg-background p-4 text-sm">请先在主窗口登录若依。</p>
    }

    return <RuoyiLoginForm auth={auth} notice={statusError} />
  }

  async function signOut() {
    if (!auth || signingOut) {
      return
    }

    setSigningOut(true)
    setStatusError('')

    try {
      await auth.logout()
    } catch (error) {
      setStatusError(message(error))
    } finally {
      setSigningOut(false)
    }
  }

  return (
    <RuoyiAccountContext.Provider value={{ account, signOut, signingOut }}>{children}</RuoyiAccountContext.Provider>
  )
}

interface LoginProps {
  auth: RuoyiAuthBridge
  notice: string
}

function RuoyiLoginForm({ auth, notice }: LoginProps) {
  const [captcha, setCaptcha] = useState<RuoyiCaptcha>()
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [captchaError, setCaptchaError] = useState('')
  const [loginError, setLoginError] = useState('')
  const [code, setCode] = useState('')
  const [password, setPassword] = useState('')
  const captchaRequests = useRef({ generation: 0 }).current

  const refreshCaptcha = useCallback(async () => {
    const request = ++captchaRequests.generation

    setLoading(true)
    setCaptcha(undefined)
    setCaptchaError('')
    setCode('')

    try {
      const result = await auth.captcha()

      if (request === captchaRequests.generation) {
        setCaptcha(result)
      }
    } catch (error) {
      if (request === captchaRequests.generation) {
        setCaptchaError(message(error))
      }
    } finally {
      if (request === captchaRequests.generation) {
        setLoading(false)
      }
    }
  }, [auth, captchaRequests])

  useEffect(() => {
    void refreshCaptcha()

    return () => {
      captchaRequests.generation++
    }
  }, [captchaRequests, refreshCaptcha])

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()

    if (!captcha || submitting || loading) {
      return
    }

    const form = new FormData(event.currentTarget)
    setSubmitting(true)
    setLoginError('')

    try {
      await auth.login({
        username: String(form.get('username') ?? ''),
        password,
        ...(captcha.enabled ? { code: code.trim(), uuid: captcha.uuid } : {})
      })
    } catch (error) {
      setLoginError(message(error))
      await refreshCaptcha()
    } finally {
      setPassword('')
      setSubmitting(false)
    }
  }

  return (
    <main
      className="relative isolate grid h-screen place-items-center overflow-auto bg-white px-5 py-12 text-slate-950
        [--dt-card:#ffffff] [--dt-composer-ring:#7955d8] [--dt-destructive:#b42318]
        [--dt-input-bg:100%] [--dt-input-border:28%] [--dt-input-inset:none]"
    >
      <div
        aria-hidden
        className="absolute inset-x-0 top-0 z-10 h-[var(--titlebar-height,34px)] [-webkit-app-region:drag]"
      />
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 top-1/2 -z-10 mx-auto aspect-square w-[min(100vw,88vh,44rem)]
          -translate-y-1/2"
      >
        <Orb backgroundColor="#ffffff" size={1.18} />
      </div>
      <form
        className="w-full max-w-[21.5rem] space-y-4 rounded-[18px] border border-violet-100 bg-white p-6
          shadow-[0_20px_64px_-18px_rgba(57,33,123,0.24)] sm:p-7"
        onSubmit={submit}
      >
        <div className="mb-5 flex items-center gap-3">
          <span
            aria-hidden
            className="grid size-10 shrink-0 place-items-center rounded-[12px] bg-[#f2edfc]"
          >
            <span
              className="size-5 rounded-full bg-[conic-gradient(from_210deg,#8a64eb,#6954d0,#7fa7ed,#ce8edc,#8a64eb)]
                p-[3px]"
            >
              <span className="block size-full rounded-full bg-[#f2edfc]" />
            </span>
          </span>
          <div>
            <h1 className="text-2xl font-semibold tracking-tight text-slate-950">登录 Magic</h1>
            <p className="mt-0.5 text-sm text-slate-600">使用你的企业账号继续</p>
          </div>
        </div>
        <label className="block space-y-1.5 text-sm font-medium">
          <span>账号</span>
          <Input
            autoComplete="username"
            className="rounded-[8px] text-slate-950 placeholder:text-slate-500"
            disabled={submitting}
            name="username"
            placeholder="输入账号"
            required
            size="lg"
          />
        </label>
        <label className="block space-y-1.5 text-sm font-medium">
          <span>密码</span>
          <Input
            autoComplete="current-password"
            className="rounded-[8px] text-slate-950 placeholder:text-slate-500"
            disabled={submitting}
            onChange={event => setPassword(event.target.value)}
            placeholder="输入密码"
            required
            size="lg"
            type="password"
            value={password}
          />
        </label>
        {captcha?.enabled && (
          <div className="flex items-end gap-2">
            <label className="min-w-0 flex-1 space-y-1.5 text-sm font-medium">
              <span>验证码</span>
              <Input
                className="rounded-[8px] text-slate-950 placeholder:text-slate-500"
                disabled={submitting}
                onChange={event => setCode(event.target.value)}
                placeholder="输入结果"
                required
                size="lg"
                value={code}
              />
            </label>
            <Button
              aria-label="刷新验证码"
              className="h-[2.375rem] overflow-hidden rounded-[8px] border border-violet-100 bg-violet-50 p-0"
              disabled={submitting}
              onClick={() => void refreshCaptcha()}
              type="button"
              variant="outline"
            >
              <img alt="若依验证码" className="block h-full w-auto" src={`data:image/jpeg;base64,${captcha.image}`} />
            </Button>
          </div>
        )}
        {(loginError || captchaError || notice) && (
          <Alert className="bg-red-50" variant="destructive">
            <AlertCircle aria-hidden className="text-red-700" />
            <AlertDescription className="text-red-800">{loginError || captchaError || notice}</AlertDescription>
          </Alert>
        )}
        {captchaError && (
          <Button
            className="text-violet-700 hover:text-violet-900"
            onClick={() => {
              setLoginError('')
              void refreshCaptcha()
            }}
            size="inline"
            type="button"
            variant="text"
          >
            重新连接
          </Button>
        )}
        <Button
          aria-label={submitting ? '正在登录…' : loading ? '正在连接…' : undefined}
          className="w-full rounded-[8px] bg-[#5937bc] text-white hover:bg-[#472c99]"
          disabled={!captcha}
          loading={loading || submitting}
          size="lg"
          type="submit"
        >
          登录
        </Button>
      </form>
    </main>
  )
}
