import { redirect } from 'next/navigation'
export default function WinLossRedirect() {
  redirect('/sales-intelligence?tab=win-loss')
}
