import { NextRequest } from 'next/server'
import { ok, err } from '@/lib/api-response'
import { requireRole } from '@/lib/api-auth'
import { apiHandler } from '@/lib/api-handler'
import { checkRateLimit } from '@/lib/rate-limit'
import { SEARCH_RATE_LIMIT } from '@/lib/expensive-route-limits'
import { emptySearchResults, runGlobalSearch } from '@/lib/global-search'
import { prepareSearchQuery } from '@/lib/search-normalize'

// Top-bar search across the office: clients, cases, invoices, payments,
// documents, appointments, tasks and team. See src/lib/global-search.ts.
export async function GET(req: NextRequest) {
  return apiHandler(async () => {
    const auth = await requireRole(req, ['ADMIN', 'LAWYER', 'STAFF'])
    if (auth.error || !auth.user) return auth.error

    const sp = new URL(req.url).searchParams
    const query = prepareSearchQuery(sp.get('q'))
    const locale = sp.get('locale') === 'en' ? 'en' : 'ar'

    if (!query) {
      return ok(emptySearchResults())
    }

    const limit = await checkRateLimit(auth.user.userId, SEARCH_RATE_LIMIT)
    if (!limit.allowed) {
      return err('عدد كبير من عمليات البحث، حاول بعد دقيقة', 429)
    }

    return ok(await runGlobalSearch(auth.user, query, locale))
  })
}
