import { useEffect, useState } from 'react'
import MainLayout from './layouts/MainLayout.jsx'
import Home from './pages/Home.jsx'
import About from './pages/About.jsx'
import Services from './pages/Services.jsx'
import Process from './pages/Process.jsx'
import Projects from './pages/Projects.jsx'
import Testimonials from './pages/Testimonials.jsx'
import Contact from './pages/Contact.jsx'

const sectionOrder = [
  'home',
  'about',
  'services',
  'process',
  'projects',
  'reviews',
  'contact',
]

function App() {
  const [activeSection, setActiveSection] = useState('home')

  useEffect(() => {
    const sections = sectionOrder
      .map((sectionId) => document.getElementById(sectionId))
      .filter(Boolean)

    if (!sections.length) {
      return undefined
    }

    const observer = new IntersectionObserver(
      (entries) => {
        const visibleEntries = entries
          .filter((entry) => entry.isIntersecting)
          .sort((a, b) => b.intersectionRatio - a.intersectionRatio)

        if (visibleEntries.length > 0) {
          setActiveSection(visibleEntries[0].target.id)
        }
      },
      {
        root: null,
        rootMargin: '-15% 0px -55% 0px',
        threshold: [0, 0.25, 0.5, 0.75, 1],
      },
    )

    sections.forEach((section) => observer.observe(section))

    return () => observer.disconnect()
  }, [])

  return (
    <MainLayout currentPage={activeSection}>
      <Home />
      <About />
      <Services />
      <Process />
      <Projects />
      <Testimonials />
      <Contact />
    </MainLayout>
  )
}

export default App