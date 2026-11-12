import { useState } from 'react'

const navItems = [
  { label: 'Home', value: 'home' },
  { label: 'About', value: 'about' },
  { label: 'Services', value: 'services' },
  { label: 'Process', value: 'process' },
  { label: 'Projects', value: 'projects' },
  { label: 'Reviews', value: 'reviews' },
  { label: 'Contact', value: 'contact' },
]

function Navbar({ currentPage }) {
  const [isOpen, setIsOpen] = useState(false)

  const scrollToSection = (sectionId) => {
    const target = document.getElementById(sectionId)

    if (!target) {
      return
    }

    const offset = 96
    const top = target.getBoundingClientRect().top + window.scrollY - offset

    window.scrollTo({ top, behavior: 'smooth' })
    setIsOpen(false)
  }

  return (
    <header className="sticky top-0 z-50 border-b border-[var(--line)] bg-[rgba(245,241,235,0.9)] backdrop-blur-sm">
      <div className="container-shell flex h-20 items-center justify-between">
        <button
          type="button"
          onClick={() => scrollToSection('home')}
          className="flex items-center gap-3 text-left"
          aria-label="Braunwork home"
        >
          <div className="flex h-10 w-10 items-center justify-center border border-[var(--charcoal)] bg-[var(--charcoal)] text-sm font-semibold tracking-[0.2em] text-[var(--bg-ivory)]">
            B
          </div>
          <div>
            <div className="text-[0.62rem] font-semibold uppercase tracking-[0.26em] text-[var(--muted)]">
              Braunwork
            </div>
            <div className="text-[0.56rem] uppercase tracking-[0.2em] text-[var(--brown)]">
              Builders Corporation
            </div>
          </div>
        </button>

        <nav aria-label="Main navigation" className="hidden items-center gap-8 lg:flex">
          {navItems.map((item) => {
            const isActive = currentPage === item.value

            return (
              <button
                key={item.label}
                type="button"
                onClick={() => scrollToSection(item.value)}
                className={`text-sm font-medium uppercase tracking-[0.14em] ${
                  isActive ? 'text-[var(--charcoal)]' : 'text-[var(--muted)] hover:text-[var(--charcoal)]'
                }`}
              >
                {item.label}
              </button>
            )
          })}
        </nav>

        <div className="hidden items-center gap-4 lg:flex">
          <button type="button" onClick={() => scrollToSection('contact')} className="btn-primary">
            Get a Quote
          </button>
        </div>

        <button
          type="button"
          className="inline-flex h-11 w-11 items-center justify-center border border-[var(--charcoal)] text-[var(--charcoal)] lg:hidden"
          aria-expanded={isOpen}
          aria-label="Toggle navigation menu"
          onClick={() => setIsOpen((prev) => !prev)}
        >
          <span className="flex flex-col gap-1.5">
            <span className="block h-0.5 w-5 bg-[var(--charcoal)]" />
            <span className="block h-0.5 w-5 bg-[var(--charcoal)]" />
            <span className="block h-0.5 w-5 bg-[var(--charcoal)]" />
          </span>
        </button>
      </div>

      {isOpen && (
        <div className="border-t border-[var(--line)] bg-[var(--panel)] lg:hidden">
          <nav aria-label="Mobile navigation" className="container-shell flex flex-col py-4">
            {navItems.map((item) => (
              <button
                key={item.label}
                type="button"
                className="border-b border-[var(--line)] py-3 text-left text-sm font-medium uppercase tracking-[0.14em] text-[var(--muted)] last:border-b-0 hover:text-[var(--charcoal)]"
                onClick={() => scrollToSection(item.value)}
              >
                {item.label}
              </button>
            ))}
            <button type="button" className="btn-primary mt-4 w-full" onClick={() => scrollToSection('contact')}>
              Get a Quote
            </button>
          </nav>
        </div>
      )}
    </header>
  )
}

export default Navbar
