export type BillingProviderName = 'MANUAL' | 'TAP' | 'PAYTABS' | 'HYPERPAY'

export type BillingInterval = 'MONTHLY' | 'YEARLY'

export interface CreateCheckoutInput {
  tenantId: string
  userId: string
  planCode: string
  planName: string
  interval: BillingInterval
  amount: number // بالفلس: 29000 = 29 JOD
  currency: string
  customer: {
    name: string
    email: string
    phone?: string | null
  }
  successUrl: string
  cancelUrl: string
  webhookUrl: string
}

export interface CheckoutResult {
  provider: BillingProviderName
  checkoutUrl: string
  providerReferenceId?: string | null
  providerCustomerId?: string | null
}

export interface PaymentProvider {
  createCheckout(input: CreateCheckoutInput): Promise<CheckoutResult>
}