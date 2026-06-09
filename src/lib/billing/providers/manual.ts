import { CreateCheckoutInput, CheckoutResult, PaymentProvider } from '../types'

export class ManualBillingProvider implements PaymentProvider {
  async createCheckout(input: CreateCheckoutInput): Promise<CheckoutResult> {
    const url = new URL(input.successUrl)

    url.searchParams.set('provider', 'manual')
    url.searchParams.set('plan', input.planCode)
    url.searchParams.set('interval', input.interval)

    return {
      provider: 'MANUAL',
      checkoutUrl: url.toString(),
      providerReferenceId: null,
      providerCustomerId: null,
    }
  }
}