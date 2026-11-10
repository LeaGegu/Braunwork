import Footer from '../components/Footer.jsx'
import Navbar from '../components/Navbar.jsx'

function MainLayout({ children }) {
  return (
    <>
      <Navbar />
      {children}
      <Footer />
    </>
  )
}

export default MainLayout
