import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { TenantSwitcher } from './tenant-switcher'
import { vi, describe, it, expect, beforeEach } from 'vitest'

// Mock fetch
const mockFetch = vi.fn()
global.fetch = mockFetch

describe('TenantSwitcher', () => {
  beforeEach(() => {
    mockFetch.mockClear()
    localStorage.clear()
  })

  it('fetches and displays brands', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        data: [
          { id: 'brand-1', name: 'Brand One' },
          { id: 'brand-2', name: 'Brand Two' },
        ],
      }),
    })

    render(<TenantSwitcher />)

    // Initially might show "Select Brand" or default
    // We expect it to eventually load
    await waitFor(() => {
        expect(mockFetch).toHaveBeenCalledWith('/api/admin/tenants')
    })
    
    // Open dropdown
    const trigger = screen.getByRole('combobox')
    fireEvent.click(trigger)

    expect(await screen.findByText('Brand One')).toBeInTheDocument()
    expect(screen.getByText('Brand Two')).toBeInTheDocument()
  })

  it('persists selection to localStorage', async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({
        data: [
          { id: 'brand-1', name: 'Brand One' },
        ],
      }),
    })

    render(<TenantSwitcher />)

    // Open dropdown
    const trigger = await screen.findByRole('combobox')
    fireEvent.click(trigger)

    // Click brand
    const brandOption = await screen.findByText('Brand One')
    fireEvent.click(brandOption)

    expect(localStorage.getItem('selected_brand_id')).toBe('brand-1')
  })
})
