import { render, screen } from '@testing-library/react'
import { Sidebar } from './sidebar'
import { vi, describe, it, expect } from 'vitest'

// Mock next/navigation
vi.mock('next/navigation', () => ({
  usePathname: vi.fn(),
}))

import { usePathname } from 'next/navigation'

describe('Sidebar', () => {
  it('highlights the active link', () => {
    // Mock active path
    (usePathname as any).mockReturnValue('/brands')

    render(<Sidebar />)

    const brandsLink = screen.getByText('Brands').closest('a')
    const usersLink = screen.getByText('Users').closest('a')

    expect(brandsLink).toHaveClass('bg-muted text-primary')
    expect(usersLink).toHaveClass('text-muted-foreground')
  })

  it('highlights sub-routes', () => {
    // Mock active path subroute
    (usePathname as any).mockReturnValue('/brands/123')

    render(<Sidebar />)

    const brandsLink = screen.getByText('Brands').closest('a')
    expect(brandsLink).toHaveClass('bg-muted text-primary')
  })
})
