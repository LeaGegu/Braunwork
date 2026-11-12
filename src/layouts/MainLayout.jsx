import Footer from '../components/Footer.jsx'
import Navbar from '../components/Navbar.jsx'

function MainLayout({ children, currentPage, setCurrentPage }) {
  return (
    <div className="min-h-screen bg-[var(--bg-ivory)] text-[var(--charcoal)]">
      <Navbar currentPage={currentPage} setCurrentPage={setCurrentPage} />
      <main className="w-full">{children}</main>
      <Footer />
    </div>
  )
}

export default MainLayout
