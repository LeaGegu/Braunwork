function SectionHeader({ eyebrow, title, description, align = 'left' }) {
  const alignment = align === 'center' ? 'mx-auto text-center' : 'text-left'

  return (
    <div className={`max-w-2xl ${alignment}`}>
      {eyebrow && <p className="eyebrow mb-4">{eyebrow}</p>}
      {title && <h2 className="section-title">{title}</h2>}
      {description && <p className="mt-5 body-copy">{description}</p>}
    </div>
  )
}

export default SectionHeader
