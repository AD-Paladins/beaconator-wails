import { describe, it, expect, beforeEach } from 'vitest'
import { THEMES, getTheme, setTheme, applyTheme } from './themes.js'

describe('themes', () => {
  beforeEach(() => {
    localStorage.clear()
    document.documentElement.removeAttribute('data-theme')
  })

  describe('THEMES definitions', () => {
    const REQUIRED_THEME_IDS = ['dark', 'light', 'hc-light', 'hc-dark', 'gaming', 'lilac', 'pink']

    it('includes all required themes', () => {
      const ids = THEMES.map((t) => t.id)
      for (const id of REQUIRED_THEME_IDS) {
        expect(ids).toContain(id)
      }
    })

    it('each theme has id and labelKey', () => {
      for (const theme of THEMES) {
        expect(theme).toHaveProperty('id')
        expect(theme).toHaveProperty('labelKey')
        expect(typeof theme.id).toBe('string')
        expect(typeof theme.labelKey).toBe('string')
      }
    })

    it('has exactly 7 theme definitions', () => {
      expect(THEMES).toHaveLength(7)
    })

    it('dark theme is first (default)', () => {
      expect(THEMES[0].id).toBe('dark')
    })

    it('each labelKey starts with "theme."', () => {
      for (const theme of THEMES) {
        expect(theme.labelKey).toMatch(/^theme\./)
      }
    })
  })

  describe('getTheme', () => {
    it('returns "dark" when nothing is stored (default)', () => {
      expect(getTheme()).toBe('dark')
    })

    it('returns stored theme from localStorage', () => {
      localStorage.setItem('devdash_theme', 'light')
      expect(getTheme()).toBe('light')
    })

    it('returns stored value for any theme', () => {
      localStorage.setItem('devdash_theme', 'gaming')
      expect(getTheme()).toBe('gaming')
    })
  })

  describe('applyTheme', () => {
    it('sets data-theme attribute on documentElement', () => {
      applyTheme('light')
      expect(document.documentElement.getAttribute('data-theme')).toBe('light')
    })

    it('removes data-theme attribute for dark theme (default)', () => {
      applyTheme('light')
      applyTheme('dark')
      expect(document.documentElement.getAttribute('data-theme')).toBeNull()
    })

    it('removes data-theme attribute when called with no theme (defaults to dark)', () => {
      localStorage.setItem('devdash_theme', 'dark')
      applyTheme()
      expect(document.documentElement.getAttribute('data-theme')).toBeNull()
    })

    it('sets data-theme for non-dark themes', () => {
      applyTheme('hc-light')
      expect(document.documentElement.getAttribute('data-theme')).toBe('hc-light')

      applyTheme('pink')
      expect(document.documentElement.getAttribute('data-theme')).toBe('pink')
    })

    it('updates existing data-theme attribute', () => {
      applyTheme('light')
      applyTheme('gaming')
      expect(document.documentElement.getAttribute('data-theme')).toBe('gaming')
    })
  })

  describe('setTheme', () => {
    it('persists theme to localStorage and applies it', () => {
      setTheme('light')
      expect(localStorage.getItem('devdash_theme')).toBe('light')
      expect(document.documentElement.getAttribute('data-theme')).toBe('light')
    })
  })
})
