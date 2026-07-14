import { redirect } from 'next/navigation'

type Props = {
  params: Promise<{ id: string }>
}

export default async function LegacyInvoicePage({ params }: Props) {
  const { id } = await params
  redirect(`/dashboard/finance/invoices/${id}`)
}
