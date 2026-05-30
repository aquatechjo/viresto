import Link from 'next/link'

export default function HomePage() {
  return (
    <main className="min-h-screen bg-[#07110d] text-white overflow-hidden">
        <nav className="fixed top-0 left-0 right-0 z-50 border-b border-white/10 bg-[#07110d]/80 backdrop-blur-xl">
  <div className="max-w-7xl mx-auto px-6 h-20 flex items-center justify-between">
    <Link href="/" className="flex items-center gap-3">
      <div className="w-10 h-10 rounded-2xl bg-emerald-500 text-black font-black flex items-center justify-center">
        V
      </div>

      <span className="font-black text-xl">
        Viresto
      </span>
    </Link>

    <div className="hidden md:flex items-center gap-8 text-sm text-white/70">
      <a href="#features" className="hover:text-white transition">
        Features
      </a>

      <a href="#pricing" className="hover:text-white transition">
        Pricing
      </a>

      <a href="#cta" className="hover:text-white transition">
        Get Started
      </a>
    </div>

    <div className="flex items-center gap-3">
      <Link
        href="/dashboard"
        className="hidden sm:flex h-11 px-5 rounded-xl border border-white/10 bg-white/5 hover:bg-white/10 transition items-center justify-center font-semibold"
      >
        Login
      </Link>

      <Link
        href="/dashboard"
        className="h-11 px-5 rounded-xl bg-emerald-500 hover:bg-emerald-400 transition text-black font-bold flex items-center justify-center"
      >
        Launch
      </Link>
    </div>
  </div>
</nav>

      {/* Hero */}
      <section className="relative px-6 pt-40 pb-28">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(16,185,129,.18),transparent_40%)]" />

        <div className="relative max-w-7xl mx-auto grid lg:grid-cols-2 gap-16 items-center">

          <div>
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full border border-white/10 bg-white/5 text-sm mb-6">
              <span className="w-2 h-2 rounded-full bg-emerald-400" />
              AI-Powered Legal Workspace
            </div>

            <h1 className="text-5xl md:text-7xl font-black leading-[1.05]">
              Modern Legal
              <span className="block text-emerald-400">
                Operating System
              </span>
            </h1>

            <p className="mt-7 text-lg text-white/70 leading-8 max-w-xl">
              Viresto helps law firms manage cases, appointments,
              documents, clients, analytics, and AI workflows from one modern platform.
            </p>

            <div className="flex flex-wrap gap-4 mt-10">
              <Link
                href="/dashboard"
                className="h-14 px-7 rounded-2xl bg-emerald-500 hover:bg-emerald-400 transition-all text-black font-bold flex items-center justify-center"
              >
                Start Now
              </Link>

              <a
                href="#features"
                className="h-14 px-7 rounded-2xl border border-white/10 bg-white/5 hover:bg-white/10 transition-all font-semibold flex items-center justify-center"
              >
                Explore Features
              </a>
            </div>

            <div className="flex flex-wrap gap-6 mt-12 text-sm text-white/50">
              <span>Multi-Tenant</span>
              <span>AI Assistant</span>
              <span>Revenue Analytics</span>
              <span>Legal Workspace</span>
            </div>
          </div>

          {/* Preview */}
          <div className="relative">
            <div className="rounded-[2rem] border border-white/10 bg-white/5 backdrop-blur-xl p-5 shadow-2xl">

              <div className="flex items-center gap-2 mb-5">
                <div className="w-3 h-3 rounded-full bg-red-400" />
                <div className="w-3 h-3 rounded-full bg-yellow-400" />
                <div className="w-3 h-3 rounded-full bg-emerald-400" />
              </div>

              <div className="space-y-4">

                <div className="grid grid-cols-3 gap-4">
                  <div className="rounded-2xl bg-emerald-500/10 border border-emerald-500/20 p-4">
                    <p className="text-white/60 text-xs">Revenue</p>
                    <p className="text-2xl font-black mt-2">$24.5K</p>
                  </div>

                  <div className="rounded-2xl bg-white/5 border border-white/10 p-4">
                    <p className="text-white/60 text-xs">Cases</p>
                    <p className="text-2xl font-black mt-2">128</p>
                  </div>

                  <div className="rounded-2xl bg-white/5 border border-white/10 p-4">
                    <p className="text-white/60 text-xs">Clients</p>
                    <p className="text-2xl font-black mt-2">54</p>
                  </div>
                </div>

                <div className="rounded-2xl bg-black/30 border border-white/10 p-5">
                  <p className="text-sm text-white/50 mb-3">
                    AI Assistant
                  </p>

                  <div className="rounded-xl bg-white/5 p-4 text-sm text-white/80 leading-7">
                    Upcoming court session for Ahmed Ali is scheduled tomorrow at 10:30 AM.
                  </div>
                </div>

              </div>
            </div>
          </div>

        </div>
      </section>

      {/* Features */}
      <section
        id="features"
        className="max-w-7xl mx-auto px-6 py-20"
      >
        <div className="text-center mb-16">
          <p className="text-emerald-400 font-bold text-sm">
            FEATURES
          </p>

          <h2 className="text-4xl font-black mt-4">
            Everything Your Law Firm Needs
          </h2>

          <p className="text-white/60 mt-5 max-w-2xl mx-auto leading-8">
            Manage your legal operations, documents, appointments,
            analytics, and AI workflows from one centralized workspace.
          </p>
        </div>

        <div className="grid md:grid-cols-2 xl:grid-cols-3 gap-6">

          {[
            ['⚖️', 'Case Management'],
            ['📄', 'Document System'],
            ['📅', 'Appointments'],
            ['🤖', 'AI Legal Assistant'],
            ['📊', 'Revenue Analytics'],
            ['🔔', 'Live Notifications'],
          ].map(([icon, title]) => (
            <div
              key={title}
              className="rounded-[2rem] border border-white/10 bg-white/5 p-7 hover:bg-white/[0.07] transition-all"
            >
              <div className="text-4xl mb-5">{icon}</div>

              <h3 className="text-xl font-bold">
                {title}
              </h3>

              <p className="text-white/60 mt-3 leading-7 text-sm">
                Powerful tools designed for modern legal teams and law firms.
              </p>
            </div>
          ))}

        </div>
      </section>

      {/* Pricing */}
<section id="pricing" className="max-w-7xl mx-auto px-6 py-20">
  <div className="text-center mb-14">
    <p className="text-emerald-400 font-bold text-sm">PRICING</p>

    <h2 className="text-4xl font-black mt-4">
      Simple Plans for Modern Law Firms
    </h2>

    <p className="text-white/60 mt-5 max-w-2xl mx-auto leading-8">
      Start small and scale as your legal operations grow.
    </p>
  </div>

  <div className="grid md:grid-cols-3 gap-6">
    {[
      ['Starter', '$19', 'For solo lawyers'],
      ['Pro', '$49', 'For growing law firms'],
      ['Enterprise', 'Custom', 'For larger legal teams'],
    ].map(([name, price, desc]) => (
      <div
        key={name}
        className="rounded-[2rem] border border-white/10 bg-white/5 p-8 hover:bg-white/[0.07] transition-all"
      >
        <h3 className="text-2xl font-black">{name}</h3>
        <p className="text-white/60 mt-2">{desc}</p>

        <p className="text-4xl font-black mt-8">
          {price}
          {price !== 'Custom' && (
            <span className="text-base text-white/40 font-medium"> /mo</span>
          )}
        </p>

        <ul className="space-y-3 mt-8 text-sm text-white/70">
          <li>✓ Case management</li>
          <li>✓ Client management</li>
          <li>✓ Document uploads</li>
          <li>✓ Analytics dashboard</li>
          {name !== 'Starter' && <li>✓ AI Legal Assistant</li>}
          {name === 'Enterprise' && <li>✓ Advanced permissions</li>}
        </ul>

        <Link
          href="/dashboard"
          className="mt-8 h-12 rounded-2xl bg-emerald-500 hover:bg-emerald-400 transition text-black font-bold flex items-center justify-center"
        >
          Get Started
        </Link>
      </div>
    ))}
  </div>
</section>

     {/* FAQ */}
<section className="max-w-5xl mx-auto px-6 py-20">
  <div className="text-center mb-12">
    <p className="text-emerald-400 font-bold text-sm">FAQ</p>
    <h2 className="text-4xl font-black mt-4">
      Frequently Asked Questions
    </h2>
  </div>

  <div className="space-y-4">
    {[
      [
        'Is LexDesk suitable for solo lawyers?',
        'Yes, LexDesk is built for solo lawyers, small offices, and growing law firms.',
      ],
      [
        'Can I manage clients and cases?',
        'Yes, you can manage clients, cases, documents, payments, appointments, and tasks.',
      ],
      [
        'Does LexDesk support AI features?',
        'Yes, Pro and Enterprise plans include an AI Legal Assistant for summaries and insights.',
      ],
      [
        'Can larger firms use LexDesk?',
        'Yes, Enterprise is designed for larger teams with advanced permissions and scalability.',
      ],
    ].map(([q, a]) => (
      <div
        key={q}
        className="rounded-3xl border border-white/10 bg-white/5 p-6"
      >
        <h3 className="font-black text-lg">{q}</h3>
        <p className="text-white/60 mt-3 leading-7">{a}</p>
      </div>
    ))}
  </div>
</section>

{/* Final CTA */}
<section className="max-w-7xl mx-auto px-6 py-20">
  <div className="rounded-[2.5rem] border border-emerald-400/20 bg-emerald-500/10 p-10 md:p-16 text-center">
    <h2 className="text-4xl md:text-5xl font-black">
      Ready to modernize your law firm?
    </h2>

    <p className="text-white/60 mt-6 max-w-2xl mx-auto leading-8">
      Start managing cases, clients, documents, and legal workflows from one secure platform.
    </p>

    <Link
      href="/dashboard"
      className="mt-8 inline-flex h-14 px-8 rounded-2xl bg-emerald-500 hover:bg-emerald-400 transition text-black font-bold items-center justify-center"
    >
      Get Started Now
    </Link>
  </div>
</section>

{/* Footer */}
<footer className="border-t border-white/10">
  <div className="max-w-7xl mx-auto px-6 py-8 flex flex-col md:flex-row items-center justify-between gap-4">
    <p className="font-black text-xl">LexDesk</p>

    <p className="text-white/50 text-sm">
      © 2026 LexDesk. All rights reserved.
    </p>
  </div>
</footer>

      {/* CTA */}
      <section id="cta" className="px-6 pb-24">
        <div className="max-w-6xl mx-auto rounded-[2.5rem] border border-white/10 bg-gradient-to-br from-emerald-500/15 to-transparent p-14 text-center">

          <p className="text-emerald-400 font-bold">
            GET STARTED
          </p>

          <h2 className="text-5xl font-black mt-5">
            Upgrade Your Legal Workflow
          </h2>

          <p className="text-white/60 mt-6 max-w-2xl mx-auto leading-8">
            Join modern law firms using Viresto to streamline operations and boost productivity.
          </p>

          <Link
            href="/dashboard"
            className="inline-flex mt-10 h-14 px-8 rounded-2xl bg-emerald-500 hover:bg-emerald-400 transition-all text-black font-bold items-center justify-center"
          >
            Launch Viresto
          </Link>
        </div>
      </section>

    </main>
  )
}