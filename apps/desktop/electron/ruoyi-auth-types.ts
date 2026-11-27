export interface RuoyiAccount {
  displayName: string
  username: string
}

export type RuoyiCaptcha = { enabled: false } | { enabled: true; image: string; uuid: string }

export interface RuoyiLogin {
  username: string
  password: string
  code?: string
  uuid?: string
}

export interface RuoyiAuthBridge {
  captcha: () => Promise<RuoyiCaptcha>
  login: (input: RuoyiLogin) => Promise<RuoyiAccount>
  logout: () => Promise<void>
  status: () => Promise<RuoyiAccount | null>
  onChange: (listener: (account: RuoyiAccount | null) => void) => () => void
}
