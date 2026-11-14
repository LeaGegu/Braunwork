import { Link } from 'react-router-dom'

function NotFound() {
  return (
    <main className="min-h-screen bg-[var(--bg-ivory)] px-6 py-16 text-[var(--charcoal)]">
      <div className="container-shell">
        <p className="eyebrow">Braunwork Builders Corporation</p>
        <h1 className="section-title mt-3">Page not found</h1>
        <Link className="btn-primary mt-6" to="/">
          Return to home
        </Link>
      </div>
    </main>
  )
}

export default NotFound
