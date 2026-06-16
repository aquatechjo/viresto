import { PaymentProvider } from './types'
import { ManualBillingProvider } from './providers/manual'
import { TapBillingProvider } from './providers/tap'

export function getPaymentProvider(): PaymentProvider {
  const provider = process.env.PAYMENT_PROVIDER || 'DISABLED'

  if (
    process.env.NODE_ENV === 'production' &&
    provider.toUpperCase() === 'MANUAL'
  ) {
    throw new Error('Manual payment provider is not allowed in production')
  }

  switch (provider.toUpperCase()) {
    case 'TAP':
      return new TapBillingProvider()

    case 'MANUAL':
      return new ManualBillingProvider()

    default:
      throw new Error('Payment provider is disabled')
  }
}
