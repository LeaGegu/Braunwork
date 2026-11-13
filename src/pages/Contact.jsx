
import { useState } from 'react'
import SectionHeader from '../components/SectionHeader.jsx'

const inquiryCategories = [
  'General Inquiry',
  'Modular Kitchen',
  'Closet',
  'Vanity',
  'Entertainment Cabinet',
  'Countertops',
  'Official / Store Installation',
  'Residential Construction',
  'Interior Design',
  'Renovation',
  'Interior Fit-out',
  'Other',
]

const initialForm = {
  name: '',
  email: '',
  phone: '',
  category: '',
  subject: '',
  message: '',
}

function Contact() {
  const [formData, setFormData] = useState(initialForm)
  const [errors, setErrors] = useState({})
  const [isSubmitted, setIsSubmitted] = useState(false)

  const handleChange = (event) => {
    const { name, value } = event.target

    setFormData((prev) => ({ ...prev, [name]: value }))
    setErrors((prev) => ({ ...prev, [name]: '' }))
    setIsSubmitted(false)
  }

  const validateForm = () => {
    const nextErrors = {}

    if (!formData.name.trim()) {
      nextErrors.name = 'Please enter your full name.'
    }

    if (!formData.email.trim()) {
      nextErrors.email = 'Please enter your email address.'
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) {
      nextErrors.email = 'Please enter a valid email address.'
    }

    if (formData.phone && !/^[+()\d\s-]{7,20}$/.test(formData.phone)) {
      nextErrors.phone = 'Please enter a valid phone number.'
    }

    if (!formData.category) {
      nextErrors.category = 'Please select an inquiry category.'
    }

    if (!formData.subject.trim()) {
      nextErrors.subject = 'Please enter a subject.'
    }

    if (!formData.message.trim()) {
      nextErrors.message = 'Please enter your message.'
    }

    return nextErrors
  }

  const handleSubmit = (event) => {
    event.preventDefault()

    const nextErrors = validateForm()

    if (Object.keys(nextErrors).length > 0) {
      setErrors(nextErrors)
      setIsSubmitted(false)
      return
    }

    setErrors({})
    setIsSubmitted(true)
    setFormData(initialForm)
  }

  const contactDetails = [
    {
      label: 'Email',
      value: 'braunwork.hcorp@gmail.com',
      href: 'mailto:braunwork.hcorp@gmail.com',
    },
    {
      label: 'Phone',
      value: '09054528100',
      href: 'tel:+639054528100',
    },
    {
      label: 'Instagram',
      value: '@braunwork.h',
      href: 'https://www.instagram.com/braunwork.h/',
    },
    {
      label: 'Location',
      value: 'Dasmariñas City, Cavite, Philippines',
      href: null,
    },
  ]

  return (
    <section
      id="contact"
      className="section-shell border-b border-[var(--line)] bg-[var(--bg-warm)]"
    >
      <div className="container-shell">
        <div className="mb-12 max-w-3xl">
          <p className="eyebrow mb-4">Contact / Let's Build</p>
          <h2 className="section-title">
            Let's talk about your next project.
          </h2>
        </div>

        <div className="grid gap-10 lg:grid-cols-[0.8fr_1.2fr] lg:items-start">
          <div className="space-y-6">
            <div className="border border-[var(--line)] bg-[var(--panel)] p-6 shadow-[var(--shadow-soft)]">
              <p className="body-copy">
                Reach out to Braunwork Builders Corporation for residential
                construction, modular cabinetry, renovation, and interior
                fit-out solutions.
              </p>
            </div>

            <div className="grid gap-4">
              {contactDetails.map((detail) => (
                <div
                  key={detail.label}
                  className="border border-[var(--line)] bg-[var(--panel)] p-5"
                >
                  <p className="text-[0.65rem] font-semibold uppercase tracking-[0.18em] text-[var(--brown)]">
                    {detail.label}
                  </p>

                  {detail.href ? (
                    <a
                      href={detail.href}
                      target={detail.href.startsWith('http') ? '_blank' : undefined}
                      rel={detail.href.startsWith('http') ? 'noreferrer' : undefined}
                      className="mt-3 block text-base leading-7 text-[var(--charcoal)] underline underline-offset-4"
                    >
                      {detail.value}
                    </a>
                  ) : (
                    <p className="mt-3 text-base leading-7 text-[var(--charcoal)]">
                      {detail.value}
                    </p>
                  )}
                </div>
              ))}
            </div>
          </div>

          <div className="border border-[var(--line)] bg-[var(--panel)] p-5 shadow-[var(--shadow-soft)] sm:p-7">
            <SectionHeader
              eyebrow="Inquire"
              title="Tell us about your project needs."
              description="Send us your project details and our team can assist you."
            />

            <form
              onSubmit={handleSubmit}
              noValidate
              className="mt-8 space-y-5"
              aria-label="Braunwork inquiry form"
            >
              <div className="grid gap-5 md:grid-cols-2">
                <div>
                  <label htmlFor="name" className="mb-2 block text-sm font-medium uppercase tracking-[0.12em] text-[var(--muted)]">
                    Full Name
                  </label>
                  <input
                    id="name"
                    name="name"
                    type="text"
                    value={formData.name}
                    onChange={handleChange}
                    className={`w-full border bg-white px-4 py-3 text-base text-[var(--charcoal)] outline-none ${errors.name ? 'border-red-500' : 'border-[var(--line)] focus:border-[var(--brown)]'}`}
                    aria-invalid={Boolean(errors.name)}
                  />
                  {errors.name && <p className="mt-2 text-sm text-red-600">{errors.name}</p>}
                </div>

                <div>
                  <label htmlFor="email" className="mb-2 block text-sm font-medium uppercase tracking-[0.12em] text-[var(--muted)]">
                    Email Address
                  </label>
                  <input
                    id="email"
                    name="email"
                    type="email"
                    value={formData.email}
                    onChange={handleChange}
                    className={`w-full border bg-white px-4 py-3 text-base text-[var(--charcoal)] outline-none ${errors.email ? 'border-red-500' : 'border-[var(--line)] focus:border-[var(--brown)]'}`}
                    aria-invalid={Boolean(errors.email)}
                  />
                  {errors.email && <p className="mt-2 text-sm text-red-600">{errors.email}</p>}
                </div>

                <div>
                  <label htmlFor="phone" className="mb-2 block text-sm font-medium uppercase tracking-[0.12em] text-[var(--muted)]">
                    Phone Number
                  </label>
                  <input
                    id="phone"
                    name="phone"
                    type="tel"
                    value={formData.phone}
                    onChange={handleChange}
                    className={`w-full border bg-white px-4 py-3 text-base text-[var(--charcoal)] outline-none ${errors.phone ? 'border-red-500' : 'border-[var(--line)] focus:border-[var(--brown)]'}`}
                    aria-invalid={Boolean(errors.phone)}
                  />
                  {errors.phone && <p className="mt-2 text-sm text-red-600">{errors.phone}</p>}
                </div>

                <div>
                  <label htmlFor="category" className="mb-2 block text-sm font-medium uppercase tracking-[0.12em] text-[var(--muted)]">
                    Inquiry Category
                  </label>
                  <select
                    id="category"
                    name="category"
                    value={formData.category}
                    onChange={handleChange}
                    className={`w-full border bg-white px-4 py-3 text-base text-[var(--charcoal)] outline-none ${errors.category ? 'border-red-500' : 'border-[var(--line)] focus:border-[var(--brown)]'}`}
                    aria-invalid={Boolean(errors.category)}
                  >
                    <option value="">Select a category</option>
                    {inquiryCategories.map((category) => (
                      <option key={category} value={category}>
                        {category}
                      </option>
                    ))}
                  </select>
                  {errors.category && <p className="mt-2 text-sm text-red-600">{errors.category}</p>}
                </div>

                <div className="md:col-span-2">
                  <label htmlFor="subject" className="mb-2 block text-sm font-medium uppercase tracking-[0.12em] text-[var(--muted)]">
                    Subject
                  </label>
                  <input
                    id="subject"
                    name="subject"
                    type="text"
                    value={formData.subject}
                    onChange={handleChange}
                    className={`w-full border bg-white px-4 py-3 text-base text-[var(--charcoal)] outline-none ${errors.subject ? 'border-red-500' : 'border-[var(--line)] focus:border-[var(--brown)]'}`}
                    aria-invalid={Boolean(errors.subject)}
                  />
                  {errors.subject && <p className="mt-2 text-sm text-red-600">{errors.subject}</p>}
                </div>

                <div className="md:col-span-2">
                  <label htmlFor="message" className="mb-2 block text-sm font-medium uppercase tracking-[0.12em] text-[var(--muted)]">
                    Message
                  </label>
                  <textarea
                    id="message"
                    name="message"
                    rows="5"
                    value={formData.message}
                    onChange={handleChange}
                    className={`w-full resize-none border bg-white px-4 py-3 text-base text-[var(--charcoal)] outline-none ${errors.message ? 'border-red-500' : 'border-[var(--line)] focus:border-[var(--brown)]'}`}
                    aria-invalid={Boolean(errors.message)}
                  />
                  {errors.message && <p className="mt-2 text-sm text-red-600">{errors.message}</p>}
                </div>
              </div>

              <div className="mt-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                <button type="submit" className="btn-primary">
                  Submit Inquiry
                </button>
                <p className="text-sm text-[var(--muted)]">
                  Demo only — backend connection pending.
                </p>
              </div>

              {isSubmitted && (
                <div className="mt-6 border border-emerald-700 bg-emerald-50 p-4 text-sm text-emerald-900">
                  Your form passed validation, but this is currently a demo.
                  Your inquiry has not been sent or stored.
                </div>
              )}
            </form>
          </div>
        </div>
      </div>
    </section>
  )
}

export default Contact
