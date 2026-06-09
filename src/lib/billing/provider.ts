import { PaymentProvider } from './types'
import { ManualBillingProvider } from './providers/manual'
import { TapBillingProvider } from './providers/tap'

export function getPaymentProvider(): PaymentProvider {
  const provider = process.env.PAYMENT_PROVIDER || 'MANUAL'

  switch (provider.toUpperCase()) {
    case 'TAP':
      return new TapBillingProvider()

    case 'MANUAL':
      return new ManualBillingProvider()

    default:
      return new ManualBillingProvider()
  }
}