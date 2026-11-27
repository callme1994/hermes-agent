import { IconLogout } from '@tabler/icons-react'
import { createContext, useContext } from 'react'
import { useNavigate } from 'react-router'

import { SETTINGS_ROUTE } from '@/app/routes'
import { AvatarChip } from '@/components/ui/avatar-chip'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger
} from '@/components/ui/dropdown-menu'
import { SidebarFooter } from '@/components/ui/sidebar'
import { ChevronDown, Settings } from '@/lib/icons'

import type { RuoyiAccount } from '../../../electron/ruoyi-auth-types'

interface RuoyiAccountActions {
  account: RuoyiAccount
  signingOut: boolean
  signOut: () => Promise<void>
}

export const RuoyiAccountContext = createContext<RuoyiAccountActions | null>(null)

export function RuoyiAccountMenu() {
  const actions = useContext(RuoyiAccountContext)
  const navigate = useNavigate()

  if (!actions) {
    return null
  }

  const { account, signingOut, signOut } = actions

  return (
    <SidebarFooter className="shrink-0 border-t border-border/60 px-2.5 py-2">
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            aria-label={`账户菜单，${account.displayName}`}
            className="w-full min-w-0 justify-start gap-2 rounded-md px-2 py-1.5"
            disabled={signingOut}
            type="button"
            variant="ghost"
          >
            <AvatarChip aria-hidden className="size-7 rounded-full bg-primary/15 text-primary" name={account.displayName} />
            <span className="min-w-0 flex-1 truncate text-left text-foreground">
              {signingOut ? '正在退出…' : account.displayName}
            </span>
            <ChevronDown aria-hidden className="text-muted-foreground" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" className="w-56" side="top" sideOffset={8}>
          <DropdownMenuLabel className="flex items-center gap-2 px-2.5 py-2">
            <AvatarChip aria-hidden className="size-8 rounded-full bg-primary/15 text-primary" name={account.displayName} />
            <div className="min-w-0 flex-1">
              <div className="truncate text-sm font-medium text-foreground">{account.displayName}</div>
              <div className="truncate text-xs font-normal text-muted-foreground">{account.username}</div>
            </div>
          </DropdownMenuLabel>
          <DropdownMenuSeparator />
          <DropdownMenuItem onSelect={() => navigate(SETTINGS_ROUTE)}>
            <Settings aria-hidden />
            设置
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem disabled={signingOut} onSelect={() => void signOut()} variant="destructive">
            <IconLogout aria-hidden />
            退出登录
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </SidebarFooter>
  )
}
